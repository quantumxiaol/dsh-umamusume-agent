import Schema from '@deepseek-ai/schemastery';
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment';
export const API_DEFAULTS = {
    ASR_API_BASE_URL: 'https://api.xiaomimimo.com/v1',
    ASR_MODEL: 'mimo-v2.5-asr',
    TTS_ENABLED: 'false',
    TTS_PROVIDER: 'mimo',
    TTS_LANGUAGE: 'zh',
    TTS_API_BASE_URL: 'https://api.xiaomimimo.com/v1',
    TTS_MODEL: 'mimo-v2.5-tts-voiceclone',
    TTS_VOICE: 'mimo_default',
    GENIMG_API_BASE_URL: 'https://api.openai.com/v1',
    GENIMG_MODEL: 'gpt-image-2',
};
export const Config = Schema.object({
    charactersDirectory: Schema.string().default('').description('Custom character directory; empty uses the bundled cards.'),
    defaultCharacter: Schema.string().default('rice_shower'),
    STORY_DIRECTORY: Schema.string().default(''),
    STORY_CHARACTER_MAP: Schema.string().default(''),
    ASR_API_BASE_URL: Schema.string().default(''),
    ASR_MODEL: Schema.string().default(''),
    TTS_ENABLED: Schema.string().default(''),
    TTS_PROVIDER: Schema.string().default(''),
    TTS_LANGUAGE: Schema.string().default(''),
    TTS_API_BASE_URL: Schema.string().default(''),
    TTS_MODEL: Schema.string().default(''),
    TTS_VOICE: Schema.string().default(''),
    GENIMG_API_BASE_URL: Schema.string().default(''),
    GENIMG_MODEL: Schema.string().default(''),
});
export function resolveConfig(ctx, config) {
    const environment = launchEnvironmentOf(ctx);
    const resolved = { ...config };
    for (const key of Object.keys(API_DEFAULTS)) {
        resolved[key] = config[key].trim() || environment.get(key)?.value.trim() || API_DEFAULTS[key];
    }
    for (const key of ['STORY_DIRECTORY', 'STORY_CHARACTER_MAP']) {
        resolved[key] = config[key].trim() || environment.get(key)?.value.trim() || '';
    }
    return resolved;
}
export const API_KEY_REFS = {
    asr: 'ASR_API_KEY',
    tts: 'TTS_API_KEY',
    image: 'GENIMG_API_KEY',
    search: 'DEEPSEEK_API_KEY',
};
export const REQUEST_TIMEOUT_MS = 180_000;
export const MAX_ASR_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
