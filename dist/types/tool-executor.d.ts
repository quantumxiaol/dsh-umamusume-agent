import type { Context } from '@deepseek-ai/cordis';
/** Keep native tool calls scoped to this preset/helper on both Harness APIs. */
export declare function useNativeTools(ctx: Context, allowedNames?: readonly string[]): Promise<void>;
