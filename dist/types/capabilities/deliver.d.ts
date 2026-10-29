import type { Context } from '@deepseek-ai/cordis';
import type { ToolExecution } from '@deepseek-ai/dsh-tools';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { ToolCallId } from '@deepseek-ai/dsh-llm';
import type { FileAttachmentRef, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
export interface DeliveryOrigin {
    turn: number;
    callId: ToolCallId;
}
export declare function registerDeliverables(ctx: Context): void;
export declare function queueDeliverable(ctx: Context, exec: ToolExecution, attachment: FileAttachmentRef | ImageAttachmentRef, description: string): void;
export declare function captureDeliveryOrigin(ctx: Context, agent: Agent, callId?: ToolCallId): DeliveryOrigin;
export declare function presentDeliverable(ctx: Context, agent: Agent, attachment: FileAttachmentRef | ImageAttachmentRef, description: string, origin: DeliveryOrigin): string;
