import type { CharacterCard } from '../characters/types.js';
import type { StorySource } from './types.js';
export declare class StoryCatalog {
    private readonly root;
    private readonly characterIds;
    private readonly files;
    private constructor();
    static load(directory: string, mappingPath: string): StoryCatalog;
    storyFor(character: CharacterCard): StorySource | undefined;
}
