import { randomUUID } from 'node:crypto';
import { BlockAssembler, MessageId } from '@deepseek-ai/dsh-llm';
import { appendPluginRecord } from '@deepseek-ai/dsh-session';
import { actorPrompt, MEMORY_PROMPT } from './prompts.js';
import { ActorReply, THREAD_RECORD } from './state.js';
export function modelConfig(agent) {
    const current = agent.session.requestHeader()?.config;
    const provider = current?.provider ?? agent.options.provider;
    const model = current?.model ?? agent.options.model;
    if (!provider || !model)
        throw new Error('无法确定当前会话的模型路由，请先选择模型。');
    return { provider, model, ...(current?.reasoningEffort ?? agent.options.reasoningEffort ? { reasoningEffort: current?.reasoningEffort ?? agent.options.reasoningEffort } : {}), maxTokens: Math.min(current?.maxTokens ?? agent.options.maxTokens ?? 8192, 8192) };
}
export function threadMessages(messages) {
    return messages.map(message => message.role === 'user'
        ? { id: MessageId(message.id), role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: message.text }] }
        : { id: MessageId(message.id), role: 'assistant', source: { kind: 'model', provider: message.provider, model: message.model }, content: [{ type: 'text', text: message.text }] });
}
export function scenePacket(thread, lines, scene, intent, fullScene = false) {
    const patch = Object.fromEntries(Object.entries(scene).filter(([key, value]) => thread.scene[key] !== value));
    return JSON.stringify({
        events: lines.slice(thread.seen),
        ...(thread.seen === 0 || fullScene ? { current_scene: scene } : Object.keys(patch).length ? { scene_patch: patch } : {}),
        intent,
    });
}
async function collect(call, system, messages, sessionId, signal) {
    const assembler = new BlockAssembler();
    let finished = false;
    for await (const chunk of call.stream({ ...call.config, system, messages, sessionId: sessionId, tools: [], signal })) {
        signal.throwIfAborted();
        assembler.push(chunk);
        if (chunk.type === 'finish')
            finished = true;
    }
    signal.throwIfAborted();
    if (!finished || assembler.finish.kind !== 'stop')
        throw new Error(`角色模型未完整返回（${finished ? assembler.finish.kind : 'stream interrupted'}），本次内容未发布。`);
    if (assembler.blocks().some(block => block.type === 'tool-call'))
        throw new Error('角色回复包含意外工具调用，已停止本轮。');
    const text = assembler.blocks().filter(block => block.type === 'text').map(block => block.text).join('').trim();
    if (!text)
        throw new Error('角色模型返回空白内容。');
    return { text, usage: assembler.usage };
}
export function parseActorReply(text) {
    let value;
    try {
        value = JSON.parse(text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```$/, ''));
    }
    catch {
        throw new Error('角色回复不是完整 JSON，未发布或提交配音；可以发送下一句继续。');
    }
    const parsed = ActorReply.safeParse(value);
    if (!parsed.success)
        throw new Error('角色回复缺少有效动作、对白或配音文本，未发布或提交配音。');
    return parsed.data;
}
function userPacket(text) { return { id: randomUUID(), role: 'user', text }; }
async function compactThread(ctx, agent, thread, lines, signal) {
    let memory = thread.memory;
    const latestTurn = lines.at(-1)?.turn;
    const boundary = Math.max(thread.memoryUntil, lines.findIndex(line => line.turn === latestTurn));
    const unseen = lines.slice(thread.memoryUntil, boundary);
    // Public events only: hidden per-turn directions never become shared character memory.
    for (let offset = 0; offset < unseen.length;) {
        const call = await ctx.llm.prepareCall(modelConfig(agent), signal);
        const batchBudget = Math.min(16000, Math.floor(((call.context?.contextWindow ?? 128000) - (call.config.maxTokens ?? 8192)) * 0.6) - memory.length - MEMORY_PROMPT.length - 1000);
        if (batchBudget < 1)
            throw new Error('当前模型窗口不足以整理角色记忆，原上下文已保留。');
        const batch = [];
        let length = 0;
        while (offset < unseen.length) {
            const line = unseen[offset];
            const lineLength = JSON.stringify(line).length;
            if (length + lineLength > batchBudget) {
                if (!batch.length)
                    throw new Error('一条公开事件超过当前模型的记忆整理预算，请使用更大上下文模型。');
                break;
            }
            batch.push(line);
            length += lineLength;
            offset += 1;
        }
        const result = await collect(call, MEMORY_PROMPT, threadMessages([userPacket(JSON.stringify({ memory, events: batch }))]), `${thread.id}-memory`, signal);
        if (result.text.length > 6000)
            throw new Error('角色记忆摘要过长，保留原上下文并停止本轮。');
        memory = result.text;
    }
    return { ...thread, memory, memoryUntil: boundary, seen: boundary, messages: memory ? [userPacket(`已发生公开事件的记忆（不含未来剧情）：\n${memory}`)] : [] };
}
export async function performActor(ctx, agent, character, intent, turn, signal) {
    const session = ctx.sessions.get(agent.id);
    if (!session)
        throw new Error('当前剧情会话不可用。');
    let state = ctx.umamusume.directorState(agent);
    const setup = state.setup;
    if (!setup || !setup.cast.includes(character.id))
        throw new Error('角色不在当前故事出演名单中。');
    let thread = state.threads[character.id];
    if (!thread) {
        thread = { id: randomUUID(), system: actorPrompt(character, setup, setup.cast.map(id => ctx.umamusume.character(id)), ctx.umamusume.settings.TTS_LANGUAGE), messages: [], seen: 0, scene: state.current.scene, memory: '', memoryUntil: 0 };
        appendPluginRecord(session, THREAD_RECORD, { character: character.id, initial: thread, messages: [], seen: 0, scene: thread.scene });
    }
    const call = await ctx.llm.prepareCall(modelConfig(agent), signal);
    const budget = Math.min(60_000, Math.floor(((call.context?.contextWindow ?? 128_000) - (call.config.maxTokens ?? 8192)) * 0.6));
    let packet = scenePacket(thread, state.lines, state.current.scene, intent);
    const size = () => thread.system.length + packet.length + thread.messages.reduce((sum, item) => sum + item.text.length + 80, 0);
    let checkpoint;
    if (size() > budget) {
        checkpoint = await compactThread(ctx, agent, thread, state.lines, signal);
        thread = checkpoint;
        packet = scenePacket(thread, state.lines, state.current.scene, intent, true);
    }
    if (size() > budget)
        throw new Error('角色上下文超出当前模型预算；请换用更大上下文模型或新建故事，原始剧情已保留。');
    const request = userPacket(packet);
    const result = await collect(call, thread.system, threadMessages([...thread.messages, request]), thread.id, signal);
    const reply = parseActorReply(result.text);
    signal.throwIfAborted();
    state = ctx.umamusume.directorState(agent);
    const line = { id: randomUUID(), turn, kind: 'dialogue', character: character.id, name: character.name, action: reply.action, text: reply.dialogue };
    appendPluginRecord(session, THREAD_RECORD, {
        character: character.id, ...(checkpoint ? { initial: checkpoint } : {}),
        messages: [request, { id: randomUUID(), role: 'assistant', text: result.text, provider: call.config.provider, model: call.config.model }],
        seen: state.lines.length + 1, scene: state.current.scene, line,
        ...(result.usage ? { usage: result.usage } : {}),
    });
    return { line, spokenText: reply.spokenText };
}
