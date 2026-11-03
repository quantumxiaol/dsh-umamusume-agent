export function sameScene(left, right) {
    return ['location', 'time', 'weather', 'lighting', 'atmosphere', 'wardrobe', 'props'].every(key => left[key] === right[key]);
}
export function sceneCgJobs(jobs, scene, turn) {
    return jobs.filter(job => job.turn <= turn && sameScene(job.scene, scene));
}
export function cgCooldownRemaining(jobs, turn) {
    return Math.max(0, ...jobs.map(job => 3 - (turn - job.turn)));
}
export function currentSceneCg(state) {
    const characters = [...new Set(state.lines.filter(line => line.turn === state.current.turn && line.kind === 'dialogue' && line.character).map(line => line.character))];
    return {
        description: `为当前已发生的互动绘制场景插画，以本轮公开表演、当前环境、服装和道具为准；捕捉自然的互动瞬间，不添加未来事件。${state.current.scene.location ? '' : `公开开场供环境参考：${state.setup?.opening.slice(0, 1000) ?? ''}`}`,
        characters,
        reason: state.cgJobs.length ? 'scene-change' : 'opening',
    };
}
export function automaticCg(state, requested) {
    if (!state.cgEnabled)
        return undefined;
    if (requested)
        return requested;
    const last = state.cgJobs.at(-1);
    // Do not retry an error every turn. A new location/time may get a new image;
    // the queue still enforces the budget and the explicit retry path.
    if (last && last.scene.location === state.current.scene.location && last.scene.time === state.current.scene.time)
        return undefined;
    if (sceneCgJobs(state.cgJobs, state.current.scene, state.current.turn).length || cgCooldownRemaining(state.cgJobs, state.current.turn))
        return undefined;
    return currentSceneCg(state);
}
