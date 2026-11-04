import type { Context } from '@deepseek-ai/cordis';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { type DeliveryOrigin } from './deliver.js';
import type { CharacterCard } from '../characters/types.js';
export interface SpeechJobInput {
    text: string;
    style?: string;
    spokenText?: string;
    character?: CharacterCard;
    lineId?: string;
}
export declare function startTtsJob(ctx: Context, exec: ToolRunContext, input: {
    text: string;
    style?: string;
}): {
    jobId: string;
    status: 'queued';
};
export declare function queueTtsJob(ctx: Context, agent: Agent, input: SpeechJobInput, origin?: DeliveryOrigin): {
    jobId: string;
    status: 'queued';
};
export declare function retryTtsJob(ctx: Context, agent: Agent, id: string): {
    jobId: string;
    status: 'queued';
};
export declare function waitForTtsJobs(ctx: Context): Promise<void>;
