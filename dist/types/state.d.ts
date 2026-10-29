import { z } from 'zod';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
export declare const PRESET_ID = "umamusume";
export declare const STATE_KEY = "umamusume";
export declare const CHARACTER_RECORD = "plugin:umamusume/character";
export declare const TTS_JOB_RECORD = "plugin:umamusume/tts-job";
export declare const TTS_TOGGLE_RECORD = "plugin:umamusume/tts-enabled";
export declare const CharacterSelection: z.ZodObject<{
    version: z.ZodLiteral<1>;
    character: z.ZodString;
}, z.core.$strip>;
export type CharacterSelection = z.infer<typeof CharacterSelection>;
export declare const TtsToggle: z.ZodObject<{
    version: z.ZodLiteral<1>;
    enabled: z.ZodBoolean;
}, z.core.$strip>;
export type TtsToggle = z.infer<typeof TtsToggle>;
export declare const TtsJobStatus: z.ZodEnum<{
    error: "error";
    queued: "queued";
    translating: "translating";
    synthesizing: "synthesizing";
    saving: "saving";
    complete: "complete";
}>;
export declare const TtsJob: z.ZodObject<{
    id: z.ZodString;
    character: z.ZodString;
    status: z.ZodEnum<{
        error: "error";
        queued: "queued";
        translating: "translating";
        synthesizing: "synthesizing";
        saving: "saving";
        complete: "complete";
    }>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    error: z.ZodOptional<z.ZodString>;
    attachment: z.ZodOptional<z.ZodObject<{
        path: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type TtsJob = z.infer<typeof TtsJob>;
export type TtsJobStatus = z.infer<typeof TtsJobStatus>;
export declare const State: z.ZodObject<{
    version: z.ZodLiteral<1>;
    enabled: z.ZodBoolean;
    character: z.ZodString;
    started: z.ZodBoolean;
    ttsEnabled: z.ZodBoolean;
    ttsJobs: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        character: z.ZodString;
        status: z.ZodEnum<{
            error: "error";
            queued: "queued";
            translating: "translating";
            synthesizing: "synthesizing";
            saving: "saving";
            complete: "complete";
        }>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
        error: z.ZodOptional<z.ZodString>;
        attachment: z.ZodOptional<z.ZodObject<{
            path: z.ZodString;
            name: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type State = z.infer<typeof State>;
export declare const CharacterSummary: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    nameEn: z.ZodString;
}, z.core.$strip>;
export declare const PublicState: z.ZodObject<{
    version: z.ZodLiteral<1>;
    enabled: z.ZodBoolean;
    character: z.ZodString;
    started: z.ZodBoolean;
    ttsEnabled: z.ZodBoolean;
    ttsJobs: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        character: z.ZodString;
        status: z.ZodEnum<{
            error: "error";
            queued: "queued";
            translating: "translating";
            synthesizing: "synthesizing";
            saving: "saving";
            complete: "complete";
        }>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
        error: z.ZodOptional<z.ZodString>;
        attachment: z.ZodOptional<z.ZodObject<{
            path: z.ZodString;
            name: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    catalog: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        nameEn: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PublicState = z.infer<typeof PublicState>;
export declare function initialState(enabled: boolean, character: string, ttsEnabled?: boolean): State;
export declare function reduceState(state: State, event: SessionEvent): State;
declare module '@deepseek-ai/dsh-session-projection/types' {
    interface SessionProjectionStateMap {
        umamusume: State;
    }
    interface SessionProjectionMap {
        umamusume: PublicState;
    }
}
declare module '@deepseek-ai/dsh-session/types' {
    interface PluginRecordMap {
        'plugin:umamusume/character': CharacterSelection;
        'plugin:umamusume/tts-enabled': TtsToggle;
        'plugin:umamusume/tts-job': TtsJob;
    }
}
