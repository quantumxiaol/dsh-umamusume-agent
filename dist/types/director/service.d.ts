import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { CommandResult } from '@deepseek-ai/dsh-commands';
import type UmamusumeService from '../index.js';
export declare function registerDirectorProjection(ctx: Context, service: UmamusumeService): void;
export declare function recoverDirectorJobs(ctx: Context, agent: Agent): void;
export declare function configureDirector(ctx: Context, agent: Agent, argument: string): Promise<CommandResult>;
