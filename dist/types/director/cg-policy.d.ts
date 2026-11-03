import type { CgJob, DirectorPlan, DirectorState, Scene } from './state.js';
export declare function sameScene(left: Scene, right: Scene): boolean;
export declare function sceneCgJobs(jobs: readonly CgJob[], scene: Scene, turn: number): CgJob[];
export declare function cgCooldownRemaining(jobs: readonly CgJob[], turn: number): number;
export declare function currentSceneCg(state: DirectorState): NonNullable<DirectorPlan['cg']>;
export declare function automaticCg(state: DirectorState, requested?: DirectorPlan['cg']): DirectorPlan['cg'];
