import type { Context } from '@deepseek-ai/cordis';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import { DirectorPlan, type DirectorState, type StoryLine } from './state.js';
export declare function validatePlan(value: unknown, state: DirectorState): DirectorPlan;
export declare function renderStoryLines(lines: readonly StoryLine[]): string;
export declare function playScene(ctx: Context, exec: ToolRunContext, value: unknown): Promise<{
    text: string;
    turn: number;
}>;
