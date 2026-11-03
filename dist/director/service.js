import { appendPluginRecord } from '@deepseek-ai/dsh-session';
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm';
import { randomUUID } from 'node:crypto';
import { TTS_JOB_RECORD } from '../state.js';
import { queueCgJob } from './cg-jobs.js';
import { CG_RECORD, CG_TOGGLE_RECORD, DIRECTOR_KEY, DIRECTOR_PRESET_ID, DirectorState, DirectorView, SETUP_RECORD, StorySetup, TURN_RECORD, initialDirectorState, reduceDirectorState } from './state.js';
export function registerDirectorProjection(ctx, service) {
    ctx.sessionProjections.register({
        key: DIRECTOR_KEY, stateVersion: 1, stateSchema: DirectorState,
        init: header => initialDirectorState(header.agentPreset === DIRECTOR_PRESET_ID),
        apply: reduceDirectorState,
        wire: {
            viewSchema: DirectorView,
            view: state => {
                const { threads: _threads, ...publicState } = state;
                const lines = state.lines.slice(-80);
                const turns = new Set([...lines.map(line => line.turn), state.current.turn]);
                const scenes = Object.fromEntries(Object.entries(state.scenes).filter(([turn]) => turns.has(Number(turn))));
                return { ...publicState, lines, scenes, catalog: service.characters.map(({ id, name, nameEn }) => ({ id, name, nameEn })), imageAvailable: Boolean(service.availability?.image) };
            },
        },
    });
    ctx.on('agent/created', ({ agent }) => { recoverDirectorJobs(ctx, agent); return undefined; });
}
export function recoverDirectorJobs(ctx, agent) {
    const state = ctx.umamusume.directorState(agent);
    if (!state.enabled)
        return;
    const session = ctx.sessions.get(agent.id);
    if (!session)
        return;
    const error = '上次运行已中断，已完成的剧情和附件保留；可继续剧情或手动重试失败的 CG。';
    if (state.current.phase === 'acting')
        appendPluginRecord(session, TURN_RECORD, { ...state.current, phase: 'error', error });
    for (const job of state.cgJobs) {
        if (job.status === 'queued' || job.status === 'generating')
            appendPluginRecord(session, CG_RECORD, { ...job, status: 'error', error });
    }
    for (const job of ctx.umamusume.sessionState(agent).ttsJobs) {
        if (job.lineId && job.status !== 'complete' && job.status !== 'error')
            appendPluginRecord(session, TTS_JOB_RECORD, { ...job, status: 'error', error, updatedAt: Date.now() });
    }
}
export async function configureDirector(ctx, agent, argument) {
    const state = ctx.umamusume.directorState(agent);
    if (!state.enabled)
        return { kind: 'error', text: '请新建会话并选择“剧情播放”预设。' };
    if (agent.status !== 'idle')
        return { kind: 'error', text: '请先停止或等待当前剧情完成。' };
    const [, verb = '', value = ''] = /^(\S+)(?:\s+([\s\S]*))?$/.exec(argument.trim()) ?? [];
    const session = ctx.sessions.get(agent.id);
    if (!session)
        return { kind: 'error', text: '当前剧情会话不可用。' };
    if (verb === 'continue') {
        if (!state.setup)
            return { kind: 'error', text: '请先保存故事设置。' };
        agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: state.current.turn ? '继续剧情。不要替我行动或说话。' : '开始剧情。请从公开开场自然展开，等待我的回应。' }] }));
        return { kind: 'success', text: '剧情正在推进。' };
    }
    if (verb === 'setup') {
        if (state.started)
            return { kind: 'error', text: '故事已开始；更换出演角色或大纲请新建会话。' };
        let setup;
        try {
            setup = StorySetup.parse(JSON.parse(value));
        }
        catch {
            return { kind: 'error', text: '请填写故事标题、1–4 位不同角色、开场（最多 2000 字）与大纲（最多 12000 字）。' };
        }
        const cast = setup.cast.map(id => ctx.umamusume.character(id));
        const portraits = {};
        for (const character of cast) {
            if (!character.portrait)
                continue;
            const attachment = await ctx.attachments.saveFile({ data: await ctx.umamusume.portrait(character), name: `${character.id}-portrait.png` });
            const path = ctx.attachments.fileHostPath(attachment);
            if (path)
                portraits[character.id] = path;
        }
        // Asset reads can yield; do not mutate the fixed prefix if a first message started meanwhile.
        if (agent.status !== 'idle' || ctx.umamusume.directorState(agent).started)
            return { kind: 'error', text: '故事已开始，请新建会话后设置。' };
        appendPluginRecord(session, SETUP_RECORD, { setup, portraits, cgEnabled: ctx.umamusume.availability.image });
        return { kind: 'success', text: `《${setup.title}》已准备好，发送开场台词或点击“开始剧情”。` };
    }
    if (verb === 'cg' && (value === 'on' || value === 'off')) {
        if (value === 'on' && !ctx.umamusume.availability.image)
            return { kind: 'error', text: '尚未配置图像 API，请配置后重启 DSH。' };
        appendPluginRecord(session, CG_TOGGLE_RECORD, { enabled: value === 'on' });
        return { kind: 'success', text: `CG 已${value === 'on' ? '开启' : '关闭'}。` };
    }
    if (verb === 'retry-cg') {
        const job = state.cgJobs.find(item => item.id === value);
        if (!job || job.status !== 'error')
            return { kind: 'error', text: '没有可重试的失败画面。' };
        return { kind: 'success', text: queueCgJob(ctx, agent, { description: job.description, characters: job.characters, reason: 'key-moment' }, { turn: job.turn, callId: ToolCallId(randomUUID()) }, job) };
    }
    return { kind: 'success', text: '用法：/uma story setup <JSON>；/uma story cg on|off；/uma story retry-cg <任务ID>' };
}
