import type { StoryMatch, StorySource } from './types.js';
export declare function searchStory(source: StorySource, query: string, limit: number, signal: AbortSignal): Promise<{
    matches: StoryMatch[];
    truncated: boolean;
}>;
