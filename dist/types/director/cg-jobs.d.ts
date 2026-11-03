import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { type DeliveryOrigin } from '../capabilities/deliver.js';
import { type CgJob, type DirectorPlan, type Scene } from './state.js';
export declare function cgFingerprint(scene: Scene, request: NonNullable<DirectorPlan['cg']>, model: string, baseUrl: string): string;
export declare function queueCgJob(ctx: Context, agent: Agent, request: NonNullable<DirectorPlan['cg']>, origin: DeliveryOrigin, retry?: CgJob): string;
export declare function waitForCgJobs(ctx: Context): Promise<void>;
