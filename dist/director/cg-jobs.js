import { createHash, randomUUID } from 'node:crypto';
import { appendPluginRecord } from '@deepseek-ai/dsh-session';
import { generateImage } from '../capabilities/image.js';
import { presentDeliverable } from '../capabilities/deliver.js';
import { CG_RECORD } from './state.js';
import { cgCooldownRemaining } from './cg-policy.js';
const queues = new WeakMap();
const controllers = new WeakMap();
export function cgFingerprint(scene, request, model, baseUrl) {
    return createHash('sha256').update(JSON.stringify({ scene, description: request.description.trim(), characters: [...request.characters].sort(), model, baseUrl })).digest('hex');
}
export function queueCgJob(ctx, agent, request, origin, retry) {
    const state = ctx.umamusume.directorState(agent);
    if (!state.cgEnabled || !ctx.umamusume.availability.image)
        return '本会话 CG 已关闭或未配置图像端点。';
    if (!state.setup || request.characters.some(id => !state.setup.cast.includes(id)))
        throw new Error('CG 出演角色不在当前名单中。');
    const scene = retry?.scene ?? state.current.scene;
    const fingerprint = cgFingerprint(scene, request, ctx.umamusume.settings.GENIMG_MODEL, ctx.umamusume.settings.GENIMG_API_BASE_URL);
    if (!retry && state.cgJobs.some(job => job.fingerprint === fingerprint))
        return '此画面已生成或已提交过，继续使用原任务。';
    if (!retry && cgCooldownRemaining(state.cgJobs, origin.turn))
        return 'CG 尚在冷却间隔中，本轮继续文字剧情。';
    if (retry && retry.status !== 'error')
        throw new Error('只有失败的 CG 可以重试。');
    const job = { id: retry?.id ?? randomUUID(), turn: origin.turn, fingerprint, scene, description: request.description, characters: request.characters, status: 'queued' };
    const session = ctx.sessions.get(agent.id);
    if (!session)
        throw new Error('当前剧情会话不可用。');
    appendPluginRecord(session, CG_RECORD, job);
    const controller = new AbortController();
    let active = controllers.get(ctx);
    if (!active) {
        active = new Set();
        controllers.set(ctx, active);
        ctx.effect(() => () => {
            for (const item of controllers.get(ctx) ?? [])
                item.abort(new Error('CG plugin unloaded'));
            controllers.delete(ctx);
        });
    }
    active.add(controller);
    const previous = queues.get(ctx) ?? Promise.resolve();
    const next = previous.catch(() => { }).then(async () => {
        const update = (details) => {
            const liveSession = ctx.sessions.get(agent.id);
            if (liveSession)
                appendPluginRecord(liveSession, CG_RECORD, { ...job, ...details });
        };
        try {
            const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(190_000)]);
            signal.throwIfAborted();
            if (!ctx.umamusume.directorState(agent).cgEnabled)
                throw new Error('CG 已关闭，排队中的画面已取消。');
            update({ status: 'generating' });
            const characters = request.characters.map(id => ctx.umamusume.character(id));
            const references = await Promise.all(characters.filter(character => character.portrait).map(async (character) => ({ data: await ctx.umamusume.portrait(character), name: character.portrait.name })));
            const appearance = characters.map(character => `${character.name} (${character.nameEn})`).join('、');
            const referenceNames = characters.filter(character => character.portrait).map(character => character.name).join('、');
            const performance = ctx.umamusume.directorState(agent).lines.filter(line => line.turn === job.turn && line.kind !== 'user').map(line => ({ speaker: line.name, action: line.action, text: line.text }));
            const image = await generateImage(ctx.umamusume, {
                prompt: `互动视觉小说 CG，精致动画插画，横向电影构图，不要文字、字幕、边框或 UI。\n场景连续性：${JSON.stringify(scene)}\n画面：${request.description}\n本轮已发生表演：${JSON.stringify(performance)}。画面说明如与表演冲突，以已发生的表演为准，不画未来事件。\n出演角色：${appearance || '无人，纯场景'}。参考图依次为：${referenceNames || '无'}；保持人物外观、马耳、尾巴和指定服装一致。`,
                references, referenceDescription: appearance, size: '1536x1024', quality: 'auto', signal,
            });
            signal.throwIfAborted();
            const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[image.mediaType];
            const attachment = await ctx.attachments.saveFile({ data: image.data, name: `story-cg-${job.turn}.${extension}` });
            const path = presentDeliverable(ctx, agent, attachment, request.description, origin);
            update({ status: 'complete', path, name: attachment.name });
        }
        catch (error) {
            update({ status: 'error', error: error instanceof Error ? error.message : String(error) });
        }
    });
    const settled = next.finally(() => {
        controllers.get(ctx)?.delete(controller);
        if (queues.get(ctx) === settled)
            queues.delete(ctx);
    });
    queues.set(ctx, settled);
    settled.catch(error => ctx.logger.warn('Story CG job failed: %s', error instanceof Error ? error.message : String(error)));
    return 'CG 已在后台排队，完成后显示在对应剧情轮次。';
}
export async function waitForCgJobs(ctx) { await queues.get(ctx); }
