import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { type Message, type LlmCallConfig } from '@deepseek-ai/dsh-llm';
import type { CharacterCard } from '../characters/types.js';
import { ActorReply, type ActorThread, type Scene, type StoryLine, type ThreadMessage } from './state.js';
export declare function modelConfig(agent: Agent): LlmCallConfig;
export declare function threadMessages(messages: readonly ThreadMessage[]): Message[];
export declare function scenePacket(thread: ActorThread, lines: readonly StoryLine[], scene: Scene, intent: string, fullScene?: boolean): string;
export declare function parseActorReply(text: string): ActorReply;
export declare function performActor(ctx: Context, agent: Agent, character: CharacterCard, intent: string, turn: number, signal: AbortSignal): Promise<{
    line: StoryLine;
    spokenText: string;
}>;
