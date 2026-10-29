import Schema from '@deepseek-ai/schemastery';
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment';
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

export const API_DEFAULTS: Record<ApiConfigKey, string> = {
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

export const Config: Schema<Config> = Schema.object({
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

export function resolveConfig(ctx: Context, config: Config): Config {
  const environment = launchEnvironmentOf(ctx);
  const resolved = { ...config };
  for (const key of Object.keys(API_DEFAULTS) as ApiConfigKey[]) {
    resolved[key] = config[key].trim() || environment.get(key)?.value.trim() || API_DEFAULTS[key];
  }
  for (const key of ['STORY_DIRECTORY', 'STORY_CHARACTER_MAP'] as const) {
    resolved[key] = config[key].trim() || environment.get(key)?.value.trim() || '';
  }
  return resolved;
}

export const API_KEY_REFS = {
  asr: 'ASR_API_KEY',
  tts: 'TTS_API_KEY',
  image: 'GENIMG_API_KEY',
  search: 'DEEPSEEK_API_KEY',
} as const;

export const REQUEST_TIMEOUT_MS = 180_000;
export const MAX_ASR_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
