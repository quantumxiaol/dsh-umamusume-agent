import { randomUUID } from 'node:crypto';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { PERSONA_PREFIX_SECTION } from '@deepseek-ai/dsh-system-prompt';
import { apiUrl, firstChoiceMessage, responseJson } from './http.js';
export async function synthesizeFishSpeech(service, character, input, context, onStage) {
    const language = service.settings.TTS_LANGUAGE;
    if (language !== 'zh' && language !== 'ja')
        throw new Error(`不支持的配音语言：${language}`);
    if (language === 'ja' && !context)
        throw new Error('日文翻译需要当前 Agent 上下文。');
    if (language === 'ja')
        onStage?.('translating');
    const text = language === 'ja' ? await translateToJapanese(context, context.agents.requireInitiator(), input.text, input.signal) : input.text;
    onStage?.('synthesizing');
    const reference = await service.voiceReference(character);
    if (!character.referenceText)
        throw new Error(`角色 ${character.name} 缺少参考音频文本，不能使用 FishSpeech 声音克隆。`);
    const apiKey = await service.optionalApiKey('tts');
    const base = service.settings.TTS_API_BASE_URL.replace(/\/+$/, '');
    const payload = await responseJson(await fetch(apiUrl(base, base.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions'), {
        method: 'POST',
        redirect: 'error',
        headers: {
            ...(apiKey ? { 'api-key': apiKey } : {}),
            'content-type': 'application/json', accept: 'application/json', 'user-agent': 'dsh-umamusume-agent/0.1.0',
        },
        body: JSON.stringify({
            model: service.settings.TTS_MODEL,
            messages: [{ role: 'assistant', content: text }],
            audio: { voice: reference, format: 'mp3' },
            fish_speech: { reference_text: character.referenceText },
            stream: false,
        }),
        signal: AbortSignal.any([input.signal, AbortSignal.timeout(600_000)]),
    }));
    const audio = firstChoiceMessage(payload).audio;
    if (typeof audio !== 'object' || audio === null)
        throw new Error('FishSpeech 响应缺少 audio。');
    const encoded = audio.data;
    if (typeof encoded !== 'string' || !encoded)
        throw new Error('FishSpeech 响应缺少音频数据。');
    const data = Buffer.from(encoded, 'base64');
    if (!data.length)
        throw new Error('FishSpeech 返回了空音频。');
    return data;
}
export async function translateToJapanese(ctx, parent, text, signal) {
    signal.throwIfAborted();
    const handle = await ctx.agents.create({
        sessionId: randomUUID(),
        signal,
        agentOptions: { ...parent.options },
        meta: { cwd: parent.session.header.cwd },
        setup(agentCtx) {
            agentCtx.systemPrompt.section({
                name: PERSONA_PREFIX_SECTION,
                order: agentCtx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX'),
                text: '你是台词翻译器。把输入的中文台词翻译成自然、口语化的日语，保留原意、情绪、称呼和节奏。只输出日文台词本身，不输出解释、引号、动作、Markdown或分析。输入若已是日语则原样返回。',
                interpolate: false,
                complete: true,
            });
            agentCtx.systemPrompt.suppressRuntimeContext();
        },
    });
    const cancel = () => handle.agent.cancel({ kind: 'parent' });
    signal.addEventListener('abort', cancel, { once: true });
    try {
        signal.throwIfAborted();
        handle.agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }));
        await handle.agent.whenIdle();
        signal.throwIfAborted();
        const message = handle.agent.session.deriveMessages().filter(item => item.role === 'assistant').at(-1);
        const translated = message?.content.filter(block => block.type === 'text').map(block => block.text).join('').trim();
        if (!translated)
            throw new Error('日文台词翻译失败。');
        if (!/[\u3040-\u30ff]/.test(translated))
            throw new Error('翻译结果不包含日文，已停止配音。');
        return translated;
    }
    finally {
        signal.removeEventListener('abort', cancel);
        await handle.dispose();
    }
}
