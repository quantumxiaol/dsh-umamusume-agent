import { z } from 'zod';
export const PRESET_ID = 'umamusume';
export const STATE_KEY = 'umamusume';
export const CHARACTER_RECORD = 'plugin:umamusume/character';
export const TTS_JOB_RECORD = 'plugin:umamusume/tts-job';
export const TTS_TOGGLE_RECORD = 'plugin:umamusume/tts-enabled';
export const CharacterSelection = z.object({ version: z.literal(1), character: z.string().min(1) });
export const TtsToggle = z.object({ version: z.literal(1), enabled: z.boolean() });
export const TtsJobStatus = z.enum(['queued', 'translating', 'synthesizing', 'saving', 'complete', 'error']);
export const TtsJob = z.object({
    id: z.string().min(1),
    character: z.string().min(1),
    status: TtsJobStatus,
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    error: z.string().optional(),
    attachment: z.object({ path: z.string().min(1), name: z.string().min(1) }).optional(),
});
export const State = z.object({
    version: z.literal(1),
    enabled: z.boolean(),
    character: z.string().min(1),
    started: z.boolean(),
    ttsEnabled: z.boolean(),
    ttsJobs: z.array(TtsJob),
});
export const CharacterSummary = z.object({ id: z.string(), name: z.string(), nameEn: z.string() });
export const PublicState = State.extend({ catalog: z.array(CharacterSummary) });
export function initialState(enabled, character, ttsEnabled = true) {
    return { version: 1, enabled, character, started: false, ttsEnabled, ttsJobs: [] };
}
export function reduceState(state, event) {
    if (event.type === 'agent-preset/selected')
        return { ...state, enabled: event.data.agentPreset === PRESET_ID };
    if (event.type === 'user/message' && event.data.source.kind === 'user')
        return { ...state, started: true };
    if ('ignorable' in event && event.ignorable && !state.started && event.type.startsWith(CHARACTER_RECORD)) {
        return { ...state, character: CharacterSelection.parse(event.data).character };
    }
    if ('ignorable' in event && event.ignorable && event.type.startsWith(TTS_TOGGLE_RECORD)) {
        return { ...state, ttsEnabled: TtsToggle.parse(event.data).enabled };
    }
    if (event.type.startsWith(TTS_JOB_RECORD)) {
        const job = TtsJob.parse(event.data);
        return { ...state, ttsJobs: [...state.ttsJobs.filter(item => item.id !== job.id), job].slice(-5) };
    }
    return state;
}
