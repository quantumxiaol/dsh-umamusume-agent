import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type UmamusumeService from '../index.js';
import type { CharacterCard } from '../characters/types.js';
import type { SpeechSynthesisInput } from './types.js';
import type { TtsJobStatus } from '../state.js';
export declare function synthesizeFishSpeech(service: UmamusumeService, character: CharacterCard, input: SpeechSynthesisInput, context?: Context, onStage?: (status: TtsJobStatus) => void): Promise<Buffer>;
export declare function translateToJapanese(ctx: Context, parent: Agent, text: string, signal: AbortSignal): Promise<string>;
