import Schema from '@deepseek-ai/schemastery';
import type { Context } from '@deepseek-ai/cordis';
export interface Config {
    charactersDirectory: string;
    defaultCharacter: string;
    STORY_DIRECTORY: string;
    STORY_CHARACTER_MAP: string;
    ASR_API_BASE_URL: string;
    ASR_MODEL: string;
    TTS_ENABLED: string;
    TTS_PROVIDER: string;
    TTS_LANGUAGE: string;
    TTS_API_BASE_URL: string;
    TTS_MODEL: string;
    TTS_VOICE: string;
    GENIMG_API_BASE_URL: string;
    GENIMG_MODEL: string;
}
type ApiConfigKey = Exclude<keyof Config, 'charactersDirectory' | 'defaultCharacter' | 'STORY_DIRECTORY' | 'STORY_CHARACTER_MAP'>;
export declare const API_DEFAULTS: Record<ApiConfigKey, string>;
export declare const Config: Schema<Config>;
export declare function resolveConfig(ctx: Context, config: Config): Config;
export declare const API_KEY_REFS: {
    readonly asr: "ASR_API_KEY";
    readonly tts: "TTS_API_KEY";
    readonly image: "GENIMG_API_KEY";
    readonly search: "DEEPSEEK_API_KEY";
};
export declare const REQUEST_TIMEOUT_MS = 180000;
export declare const MAX_ASR_BYTES: number;
export declare const MAX_IMAGE_BYTES: number;
export {};
