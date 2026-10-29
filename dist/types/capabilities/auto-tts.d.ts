import type { Context } from '@deepseek-ai/cordis';
import type { ContentBlock } from '@deepseek-ai/dsh-llm';
export declare function registerAutoTts(ctx: Context): void;
export declare function dialogueForTts(blocks: readonly ContentBlock[]): string;
