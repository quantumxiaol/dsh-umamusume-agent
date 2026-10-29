import { Service, type Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands';
import { Config as ConfigSchema, API_KEY_REFS, type Config } from './config.js';
import type { CharacterCard, CapabilityAvailability } from './characters/types.js';
import type { StorySource } from './story/types.js';
import { type State } from './state.js';
export type { Config } from './config.js';
type Capability = keyof typeof API_KEY_REFS;
declare module '@deepseek-ai/cordis' {
    interface Context {
        umamusume: UmamusumeService;
    }
}
export default class UmamusumeService extends Service {
    static inject: string[];
    static Config: import("@deepseek-ai/schemastery").default<ConfigSchema>;
    readonly settings: Config;
    readonly characters: readonly CharacterCard[];
    private readonly byId;
    private readonly assetCache;
    private readonly story?;
    availability: CapabilityAvailability;
    constructor(ctx: Context, config: Config);
    [Service.init](): AsyncGenerator<() => Promise<void>, void>;
    character(id: string): CharacterCard;
    characterForAgent(agent?: Agent): CharacterCard;
    sessionState(agent: Agent): State;
    capabilitiesFor(character: CharacterCard, agent?: Agent): CapabilityAvailability;
    configure({ agent, rawInput }: Pick<CommandInvocation, 'agent' | 'rawInput'>): CommandResult;
    private pluginSession;
    storyFor(character: CharacterCard): StorySource | undefined;
    portrait(character: CharacterCard): Promise<Buffer>;
    voiceReference(character: CharacterCard): Promise<string>;
    optionalApiKey(capability: Capability): Promise<string | undefined>;
    apiKey(capability: Capability): Promise<string>;
    private configured;
    private readAsset;
    private presetDefinition;
}
