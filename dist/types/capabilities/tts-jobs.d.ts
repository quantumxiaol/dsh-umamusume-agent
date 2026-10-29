import type { Context } from '@deepseek-ai/cordis';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { type DeliveryOrigin } from './deliver.js';
export declare function startTtsJob(ctx: Context, exec: ToolRunContext, input: {
    text: string;
    style?: string;
}): {
    jobId: string;
    status: 'queued';
};
export declare function queueTtsJob(ctx: Context, agent: Agent, input: {
    text: string;
    style?: string;
}, origin?: DeliveryOrigin): {
    jobId: string;
    status: 'queued';
};
export declare function waitForTtsJobs(ctx: Context): Promise<void>;
