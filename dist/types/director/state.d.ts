import { z } from 'zod';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
export declare const DIRECTOR_PRESET_ID = "umamusume-director";
export declare const DIRECTOR_KEY = "umamusumeDirector";
export declare const SETUP_RECORD = "plugin:umamusume/director-setup";
export declare const TURN_RECORD = "plugin:umamusume/director-turn";
export declare const LINE_RECORD = "plugin:umamusume/director-line";
export declare const THREAD_RECORD = "plugin:umamusume/director-thread";
export declare const CG_RECORD = "plugin:umamusume/director-cg";
export declare const CG_TOGGLE_RECORD = "plugin:umamusume/director-cg-enabled";
export declare const Scene: z.ZodObject<{
    location: z.ZodString;
    time: z.ZodString;
    weather: z.ZodString;
    lighting: z.ZodString;
    atmosphere: z.ZodString;
    wardrobe: z.ZodString;
    props: z.ZodString;
}, z.core.$strip>;
export type Scene = z.infer<typeof Scene>;
export declare const StorySetup: z.ZodObject<{
    title: z.ZodString;
    cast: z.ZodArray<z.ZodString>;
    opening: z.ZodString;
    outline: z.ZodString;
}, z.core.$strict>;
export type StorySetup = z.infer<typeof StorySetup>;
export declare const DirectorPlan: z.ZodObject<{
    scene: z.ZodDefault<z.ZodObject<{
        location: z.ZodOptional<z.ZodString>;
        time: z.ZodOptional<z.ZodString>;
        weather: z.ZodOptional<z.ZodString>;
        lighting: z.ZodOptional<z.ZodString>;
        atmosphere: z.ZodOptional<z.ZodString>;
        wardrobe: z.ZodOptional<z.ZodString>;
        props: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    narration: z.ZodDefault<z.ZodString>;
    speakers: z.ZodArray<z.ZodObject<{
        character: z.ZodString;
        intent: z.ZodString;
    }, z.core.$strict>>;
    cg: z.ZodOptional<z.ZodObject<{
        description: z.ZodString;
        characters: z.ZodArray<z.ZodString>;
        reason: z.ZodEnum<{
            opening: "opening";
            "scene-change": "scene-change";
            "key-moment": "key-moment";
        }>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type DirectorPlan = z.infer<typeof DirectorPlan>;
export declare const ActorReply: z.ZodObject<{
    action: z.ZodString;
    dialogue: z.ZodString;
    spokenText: z.ZodString;
}, z.core.$strict>;
export type ActorReply = z.infer<typeof ActorReply>;
export declare const StoryLine: z.ZodObject<{
    id: z.ZodString;
    turn: z.ZodNumber;
    kind: z.ZodEnum<{
        user: "user";
        narration: "narration";
        dialogue: "dialogue";
    }>;
    character: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    action: z.ZodDefault<z.ZodString>;
    text: z.ZodString;
    sourceSeq: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type StoryLine = z.infer<typeof StoryLine>;
declare const Turn: z.ZodObject<{
    turn: z.ZodNumber;
    scene: z.ZodObject<{
        location: z.ZodString;
        time: z.ZodString;
        weather: z.ZodString;
        lighting: z.ZodString;
        atmosphere: z.ZodString;
        wardrobe: z.ZodString;
        props: z.ZodString;
    }, z.core.$strip>;
    phase: z.ZodEnum<{
        error: "error";
        complete: "complete";
        idle: "idle";
        acting: "acting";
    }>;
    speaker: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type DirectorTurn = z.infer<typeof Turn>;
export declare const CgJob: z.ZodObject<{
    id: z.ZodString;
    turn: z.ZodNumber;
    fingerprint: z.ZodString;
    scene: z.ZodObject<{
        location: z.ZodString;
        time: z.ZodString;
        weather: z.ZodString;
        lighting: z.ZodString;
        atmosphere: z.ZodString;
        wardrobe: z.ZodString;
        props: z.ZodString;
    }, z.core.$strip>;
    description: z.ZodString;
    characters: z.ZodArray<z.ZodString>;
    status: z.ZodEnum<{
        error: "error";
        queued: "queued";
        complete: "complete";
        generating: "generating";
    }>;
    path: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CgJob = z.infer<typeof CgJob>;
declare const ThreadMessage: z.ZodObject<{
    id: z.ZodString;
    role: z.ZodEnum<{
        user: "user";
        assistant: "assistant";
    }>;
    text: z.ZodString;
    provider: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ThreadMessage = z.infer<typeof ThreadMessage>;
export declare const ActorThread: z.ZodObject<{
    id: z.ZodString;
    system: z.ZodString;
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        role: z.ZodEnum<{
            user: "user";
            assistant: "assistant";
        }>;
        text: z.ZodString;
        provider: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    seen: z.ZodNumber;
    scene: z.ZodObject<{
        location: z.ZodString;
        time: z.ZodString;
        weather: z.ZodString;
        lighting: z.ZodString;
        atmosphere: z.ZodString;
        wardrobe: z.ZodString;
        props: z.ZodString;
    }, z.core.$strip>;
    memory: z.ZodString;
    memoryUntil: z.ZodNumber;
}, z.core.$strip>;
export type ActorThread = z.infer<typeof ActorThread>;
export declare const ThreadRecord: z.ZodObject<{
    character: z.ZodString;
    initial: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        system: z.ZodString;
        messages: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            role: z.ZodEnum<{
                user: "user";
                assistant: "assistant";
            }>;
            text: z.ZodString;
            provider: z.ZodOptional<z.ZodString>;
            model: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        seen: z.ZodNumber;
        scene: z.ZodObject<{
            location: z.ZodString;
            time: z.ZodString;
            weather: z.ZodString;
            lighting: z.ZodString;
            atmosphere: z.ZodString;
            wardrobe: z.ZodString;
            props: z.ZodString;
        }, z.core.$strip>;
        memory: z.ZodString;
        memoryUntil: z.ZodNumber;
    }, z.core.$strip>>;
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        role: z.ZodEnum<{
            user: "user";
            assistant: "assistant";
        }>;
        text: z.ZodString;
        provider: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    seen: z.ZodNumber;
    scene: z.ZodObject<{
        location: z.ZodString;
        time: z.ZodString;
        weather: z.ZodString;
        lighting: z.ZodString;
        atmosphere: z.ZodString;
        wardrobe: z.ZodString;
        props: z.ZodString;
    }, z.core.$strip>;
    line: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        turn: z.ZodNumber;
        kind: z.ZodEnum<{
            user: "user";
            narration: "narration";
            dialogue: "dialogue";
        }>;
        character: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        action: z.ZodDefault<z.ZodString>;
        text: z.ZodString;
        sourceSeq: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    usage: z.ZodOptional<z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        cacheReadTokens: z.ZodOptional<z.ZodNumber>;
        cacheWriteTokens: z.ZodOptional<z.ZodNumber>;
        totalTokens: z.ZodOptional<z.ZodNumber>;
        reasoningTokens: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ThreadRecord = z.infer<typeof ThreadRecord>;
export declare const SetupRecord: z.ZodObject<{
    setup: z.ZodObject<{
        title: z.ZodString;
        cast: z.ZodArray<z.ZodString>;
        opening: z.ZodString;
        outline: z.ZodString;
    }, z.core.$strict>;
    portraits: z.ZodRecord<z.ZodString, z.ZodString>;
    cgEnabled: z.ZodBoolean;
}, z.core.$strip>;
export type SetupRecord = z.infer<typeof SetupRecord>;
export declare const DirectorState: z.ZodObject<{
    enabled: z.ZodBoolean;
    started: z.ZodBoolean;
    setup: z.ZodOptional<z.ZodObject<{
        title: z.ZodString;
        cast: z.ZodArray<z.ZodString>;
        opening: z.ZodString;
        outline: z.ZodString;
    }, z.core.$strict>>;
    portraits: z.ZodRecord<z.ZodString, z.ZodString>;
    cgEnabled: z.ZodBoolean;
    current: z.ZodObject<{
        turn: z.ZodNumber;
        scene: z.ZodObject<{
            location: z.ZodString;
            time: z.ZodString;
            weather: z.ZodString;
            lighting: z.ZodString;
            atmosphere: z.ZodString;
            wardrobe: z.ZodString;
            props: z.ZodString;
        }, z.core.$strip>;
        phase: z.ZodEnum<{
            error: "error";
            complete: "complete";
            idle: "idle";
            acting: "acting";
        }>;
        speaker: z.ZodOptional<z.ZodString>;
        error: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    scenes: z.ZodRecord<z.ZodString, z.ZodObject<{
        location: z.ZodString;
        time: z.ZodString;
        weather: z.ZodString;
        lighting: z.ZodString;
        atmosphere: z.ZodString;
        wardrobe: z.ZodString;
        props: z.ZodString;
    }, z.core.$strip>>;
    lines: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        turn: z.ZodNumber;
        kind: z.ZodEnum<{
            user: "user";
            narration: "narration";
            dialogue: "dialogue";
        }>;
        character: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        action: z.ZodDefault<z.ZodString>;
        text: z.ZodString;
        sourceSeq: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    cgJobs: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        turn: z.ZodNumber;
        fingerprint: z.ZodString;
        scene: z.ZodObject<{
            location: z.ZodString;
            time: z.ZodString;
            weather: z.ZodString;
            lighting: z.ZodString;
            atmosphere: z.ZodString;
            wardrobe: z.ZodString;
            props: z.ZodString;
        }, z.core.$strip>;
        description: z.ZodString;
        characters: z.ZodArray<z.ZodString>;
        status: z.ZodEnum<{
            error: "error";
            queued: "queued";
            complete: "complete";
            generating: "generating";
        }>;
        path: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        error: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    threads: z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        system: z.ZodString;
        messages: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            role: z.ZodEnum<{
                user: "user";
                assistant: "assistant";
            }>;
            text: z.ZodString;
            provider: z.ZodOptional<z.ZodString>;
            model: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        seen: z.ZodNumber;
        scene: z.ZodObject<{
            location: z.ZodString;
            time: z.ZodString;
            weather: z.ZodString;
            lighting: z.ZodString;
            atmosphere: z.ZodString;
            wardrobe: z.ZodString;
            props: z.ZodString;
        }, z.core.$strip>;
        memory: z.ZodString;
        memoryUntil: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type DirectorState = z.infer<typeof DirectorState>;
export declare const DirectorView: z.ZodObject<{
    enabled: z.ZodBoolean;
    started: z.ZodBoolean;
    setup: z.ZodOptional<z.ZodObject<{
        title: z.ZodString;
        cast: z.ZodArray<z.ZodString>;
        opening: z.ZodString;
        outline: z.ZodString;
    }, z.core.$strict>>;
    portraits: z.ZodRecord<z.ZodString, z.ZodString>;
    cgEnabled: z.ZodBoolean;
    current: z.ZodObject<{
        turn: z.ZodNumber;
        scene: z.ZodObject<{
            location: z.ZodString;
            time: z.ZodString;
            weather: z.ZodString;
            lighting: z.ZodString;
            atmosphere: z.ZodString;
            wardrobe: z.ZodString;
            props: z.ZodString;
        }, z.core.$strip>;
        phase: z.ZodEnum<{
            error: "error";
            complete: "complete";
            idle: "idle";
            acting: "acting";
        }>;
        speaker: z.ZodOptional<z.ZodString>;
        error: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    scenes: z.ZodRecord<z.ZodString, z.ZodObject<{
        location: z.ZodString;
        time: z.ZodString;
        weather: z.ZodString;
        lighting: z.ZodString;
        atmosphere: z.ZodString;
        wardrobe: z.ZodString;
        props: z.ZodString;
    }, z.core.$strip>>;
    lines: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        turn: z.ZodNumber;
        kind: z.ZodEnum<{
            user: "user";
            narration: "narration";
            dialogue: "dialogue";
        }>;
        character: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        action: z.ZodDefault<z.ZodString>;
        text: z.ZodString;
        sourceSeq: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    cgJobs: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        turn: z.ZodNumber;
        fingerprint: z.ZodString;
        scene: z.ZodObject<{
            location: z.ZodString;
            time: z.ZodString;
            weather: z.ZodString;
            lighting: z.ZodString;
            atmosphere: z.ZodString;
            wardrobe: z.ZodString;
            props: z.ZodString;
        }, z.core.$strip>;
        description: z.ZodString;
        characters: z.ZodArray<z.ZodString>;
        status: z.ZodEnum<{
            error: "error";
            queued: "queued";
            complete: "complete";
            generating: "generating";
        }>;
        path: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        error: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    catalog: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        nameEn: z.ZodString;
    }, z.core.$strip>>;
    imageAvailable: z.ZodBoolean;
}, z.core.$strip>;
export type DirectorView = z.infer<typeof DirectorView>;
export declare function initialDirectorState(enabled: boolean): DirectorState;
export declare function reduceDirectorState(state: DirectorState, event: SessionEvent): DirectorState;
declare module '@deepseek-ai/dsh-session-projection/types' {
    interface SessionProjectionStateMap {
        umamusumeDirector: DirectorState;
    }
    interface SessionProjectionMap {
        umamusumeDirector: DirectorView;
    }
}
declare module '@deepseek-ai/dsh-session/types' {
    interface PluginRecordMap {
        'plugin:umamusume/director-setup': SetupRecord;
        'plugin:umamusume/director-turn': DirectorTurn;
        'plugin:umamusume/director-line': StoryLine;
        'plugin:umamusume/director-thread': ThreadRecord;
        'plugin:umamusume/director-cg': CgJob;
        'plugin:umamusume/director-cg-enabled': {
            enabled: boolean;
        };
    }
}
export {};
