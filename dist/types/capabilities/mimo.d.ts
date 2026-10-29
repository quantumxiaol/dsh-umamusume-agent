import type UmamusumeService from '../index.js';
import type { CharacterCard } from '../characters/types.js';
import type { Context } from '@deepseek-ai/cordis';
import type { SpeechRecognitionInput, SpeechSynthesisInput } from './types.js';
import type { TtsJobStatus } from '../state.js';
export declare function synthesizeSpeech(service: UmamusumeService, character: CharacterCard, input: SpeechSynthesisInput, context?: Context, onStage?: (status: TtsJobStatus) => void): Promise<Buffer>;
export declare function recognizeSpeech(service: UmamusumeService, input: SpeechRecognitionInput): Promise<{
    text: string;
    seconds?: number;
}>;
