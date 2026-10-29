import { randomUUID } from 'node:crypto';
import { appendPluginRecord } from '@deepseek-ai/dsh-session';
import { TTS_JOB_RECORD } from '../state.js';
import { synthesizeSpeech } from './mimo.js';
import { captureDeliveryOrigin, presentDeliverable } from './deliver.js';
const queues = new WeakMap();
const controllers = new WeakMap();
const cleanups = new WeakSet();
export function startTtsJob(ctx, exec, input) {
    if (!exec.agent)
        throw new Error('无法访问当前会话，不能创建后台配音任务。');
    const origin = captureDeliveryOrigin(ctx, exec.agent, exec.callId);
    exec.concludeTurn();
    return queueTtsJob(ctx, exec.agent, input, origin);
}
export function queueTtsJob(ctx, agent, input, origin = captureDeliveryOrigin(ctx, agent)) {
    if (!ctx.umamusume.sessionState(agent).ttsEnabled)
        throw new Error('本会话已关闭 TTS，请先开启后再试。');
    const character = ctx.umamusume.characterForAgent(agent);
    const controller = new AbortController();
    const id = randomUUID();
    const createdAt = Date.now();
    const job = { id, character: character.name, status: 'queued', createdAt, updatedAt: createdAt };
    appendTtsRecord(ctx, agent, job);
    track(ctx, controller);
    const previous = queues.get(ctx) ?? Promise.resolve();
    const next = previous.catch(() => { }).then(() => runJob(ctx, agent, job, input, controller, origin));
    const settled = next.finally(() => {
        controllers.get(ctx)?.delete(controller);
        if (queues.get(ctx) === settled)
            queues.delete(ctx);
    });
    queues.set(ctx, settled);
    settled.catch(() => { });
    return { jobId: id, status: 'queued' };
}
export async function waitForTtsJobs(ctx) {
    await queues.get(ctx);
}
async function runJob(ctx, agent, initial, input, controller, origin) {
    const character = ctx.umamusume.characterForAgent(agent);
    const update = (status, details = {}) => {
        appendTtsRecord(ctx, agent, { ...initial, ...details, status, updatedAt: Date.now() });
    };
    try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(600_000)]);
        signal.throwIfAborted();
        update('synthesizing');
        const data = await synthesizeSpeech(ctx.umamusume, character, {
            text: input.text, style: input.style, signal,
        }, ctx, update);
        update('saving');
        const attachment = await ctx.attachments.saveFile({ data, name: `${character.id}-speech.mp3` });
        const path = presentDeliverable(ctx, agent, attachment, `${character.name} 的语音`, origin);
        update('complete', { attachment: { path, name: attachment.name } });
    }
    catch (error) {
        update('error', { error: error instanceof Error ? error.message : String(error) });
    }
}
function appendTtsRecord(ctx, agent, job) {
    const session = ctx.sessions.get(agent.id);
    if (!session)
        throw new Error('当前会话不可用，不能记录配音进度。');
    appendPluginRecord(session, TTS_JOB_RECORD, job);
}
function track(ctx, controller) {
    let set = controllers.get(ctx);
    if (!set) {
        set = new Set();
        controllers.set(ctx, set);
    }
    set.add(controller);
    if (cleanups.has(ctx))
        return;
    cleanups.add(ctx);
    ctx.effect(() => () => {
        for (const active of controllers.get(ctx) ?? [])
            active.abort(new Error('TTS plugin unloaded'));
        controllers.delete(ctx);
    });
}
