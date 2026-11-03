import { z } from 'zod';
import { CharacterSummary } from '../state.js';
export const DIRECTOR_PRESET_ID = 'umamusume-director';
export const DIRECTOR_KEY = 'umamusumeDirector';
export const SETUP_RECORD = 'plugin:umamusume/director-setup';
export const TURN_RECORD = 'plugin:umamusume/director-turn';
export const LINE_RECORD = 'plugin:umamusume/director-line';
export const THREAD_RECORD = 'plugin:umamusume/director-thread';
export const CG_RECORD = 'plugin:umamusume/director-cg';
export const CG_TOGGLE_RECORD = 'plugin:umamusume/director-cg-enabled';
const shortText = z.string().trim().max(300);
export const Scene = z.object({ location: shortText, time: shortText, weather: shortText, lighting: shortText, atmosphere: shortText, wardrobe: shortText, props: shortText });
export const StorySetup = z.object({
    title: z.string().trim().min(1).max(120),
    cast: z.array(z.string().min(1)).min(1).max(4).refine(ids => new Set(ids).size === ids.length, '出演角色不能重复'),
    opening: z.string().trim().min(1).max(2000),
    outline: z.string().trim().max(12000),
}).strict();
export const DirectorPlan = z.object({
    scene: Scene.partial().default({}),
    narration: z.string().trim().max(1200).default(''),
    speakers: z.array(z.object({ character: z.string().min(1), intent: z.string().trim().min(1).max(600) }).strict()).min(1).max(3),
    cg: z.object({
        description: z.string().trim().min(1).max(1800),
        characters: z.array(z.string().min(1)).max(4),
        reason: z.enum(['opening', 'scene-change', 'key-moment']),
    }).strict().optional(),
}).strict();
export const ActorReply = z.object({
    action: z.string().trim().max(1200),
    dialogue: z.string().trim().min(1).max(2000),
    spokenText: z.string().trim().min(1).max(4000),
}).strict();
export const StoryLine = z.object({
    id: z.string(), turn: z.number().int().positive(), kind: z.enum(['user', 'narration', 'dialogue']),
    character: z.string().optional(), name: z.string(), action: z.string().default(''), text: z.string(),
    sourceSeq: z.number().int().optional(),
});
const Turn = z.object({
    turn: z.number().int().nonnegative(), scene: Scene,
    phase: z.enum(['idle', 'acting', 'complete', 'error']),
    speaker: z.string().optional(), error: z.string().optional(),
});
export const CgJob = z.object({
    id: z.string(), turn: z.number().int().positive(), fingerprint: z.string(),
    scene: Scene, description: z.string(), characters: z.array(z.string()),
    status: z.enum(['queued', 'generating', 'complete', 'error']),
    path: z.string().optional(), name: z.string().optional(), error: z.string().optional(),
});
const ThreadMessage = z.object({ id: z.string(), role: z.enum(['user', 'assistant']), text: z.string(), provider: z.string().optional(), model: z.string().optional() });
export const ActorThread = z.object({
    id: z.string(), system: z.string(), messages: z.array(ThreadMessage),
    seen: z.number().int().nonnegative(), scene: Scene,
    memory: z.string(), memoryUntil: z.number().int().nonnegative(),
});
// An immutable exchange is committed atomically with the public reply. Only checkpoints replace a thread.
export const ThreadRecord = z.object({
    character: z.string(), initial: ActorThread.optional(),
    messages: z.array(ThreadMessage), seen: z.number().int().nonnegative(), scene: Scene,
    line: StoryLine.optional(),
    usage: z.object({ inputTokens: z.number(), outputTokens: z.number(), cacheReadTokens: z.number().optional(), cacheWriteTokens: z.number().optional(), totalTokens: z.number().optional(), reasoningTokens: z.number().optional() }).optional(),
});
export const SetupRecord = z.object({ setup: StorySetup, portraits: z.record(z.string(), z.string()), cgEnabled: z.boolean() });
export const DirectorState = z.object({
    enabled: z.boolean(), started: z.boolean(), setup: StorySetup.optional(),
    portraits: z.record(z.string(), z.string()), cgEnabled: z.boolean(),
    current: Turn, scenes: z.record(z.string(), Scene), lines: z.array(StoryLine), cgJobs: z.array(CgJob), threads: z.record(z.string(), ActorThread),
});
export const DirectorView = DirectorState.omit({ threads: true }).extend({ catalog: z.array(CharacterSummary), imageAvailable: z.boolean() });
export function initialDirectorState(enabled) {
    return { enabled, started: false, portraits: {}, cgEnabled: false, current: { turn: 0, phase: 'idle', scene: { location: '', time: '', weather: '', lighting: '', atmosphere: '', wardrobe: '', props: '' } }, scenes: {}, lines: [], cgJobs: [], threads: {} };
}
function appendLine(lines, line) {
    return lines.some(item => item.id === line.id) ? lines : [...lines, line];
}
export function reduceDirectorState(state, event) {
    if (event.type === 'agent-preset/selected')
        return { ...state, enabled: event.data.agentPreset === DIRECTOR_PRESET_ID };
    if (event.type === 'user/message' && event.data.source.kind === 'user' && state.enabled && state.setup && !state.started)
        return { ...state, started: true };
    if (!('ignorable' in event) || !event.ignorable)
        return state;
    switch (String(event.type)) {
        case SETUP_RECORD: {
            if (state.started)
                return state;
            const record = SetupRecord.parse(event.data);
            return { ...initialDirectorState(state.enabled), ...record };
        }
        case TURN_RECORD: {
            const current = Turn.parse(event.data);
            return { ...state, current, scenes: { ...state.scenes, [current.turn]: current.scene } };
        }
        case LINE_RECORD: return { ...state, lines: appendLine(state.lines, StoryLine.parse(event.data)) };
        case CG_TOGGLE_RECORD: return { ...state, cgEnabled: z.object({ enabled: z.boolean() }).parse(event.data).enabled };
        case CG_RECORD: {
            const job = CgJob.parse(event.data);
            return { ...state, cgJobs: [...state.cgJobs.filter(item => item.id !== job.id), job].sort((a, b) => a.turn - b.turn).slice(-30) };
        }
        case THREAD_RECORD: {
            const record = ThreadRecord.parse(event.data);
            const previous = record.initial ?? state.threads[record.character];
            if (!previous)
                throw new Error('角色上下文缺少初始记录。');
            if (record.messages.length && previous.messages.some(message => message.id === record.messages[0].id))
                return state;
            const thread = { ...previous, messages: [...previous.messages, ...record.messages], seen: record.seen, scene: record.scene };
            return { ...state, threads: { ...state.threads, [record.character]: thread }, lines: record.line ? appendLine(state.lines, record.line) : state.lines };
        }
        default: return state;
    }
}
