import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { Context } from '@deepseek-ai/cordis';
import Sessions from '@deepseek-ai/dsh-session';
import Projections from '@deepseek-ai/dsh-session-projection';
import Agents from '@deepseek-ai/dsh-agent';
import AgentLoop from '@deepseek-ai/dsh-agent-loop';
import Llm, { LlmAdapter, ToolCallId } from '@deepseek-ai/dsh-llm';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import Tools from '@deepseek-ai/dsh-tools';
import Commands from '@deepseek-ai/dsh-commands';
import UmamusumeService from '../dist/index.js';
import * as directorPreset from '../dist/director/preset.js';
import * as commands from '../dist/commands.js';
import { DIRECTOR_PRESET_ID } from '../dist/director/state.js';
import { fixture, twoActors } from './director-fixture.mjs';

test('native plugins save story portraits and start one director turn through UI commands', { timeout: 10000 }, async () => {
  const ctx = new Context();
  const loaded = [];
  let handle;
  try {
    for (const plugin of [Projections, Sessions, Agents, Llm, SystemPrompt, Tools, AgentLoop, Commands]) loaded.push(await ctx.plugin(plugin, {}));
    const f = fixture();
    const presets = [];
    // Services must be siblings, as in Harness. Root-provided fakes or calling
    // apply() directly bypass Cordis's per-plugin injection checks.
    loaded.push(await ctx.plugin({ name: 'offline-host-services', apply(host) {
      host.provide('attachments', f.ctx.attachments);
      host.provide('credentials', { describe: async () => ({ configured: false }), resolve: async () => undefined });
      host.provide('agentPresets', { register: async definition => { presets.push(definition); return () => {}; } });
      host.provide('launchEnvironment', { get: () => undefined });
    } }));
    loaded.push(await ctx.plugin(UmamusumeService, {}));
    const service = ctx.umamusume;
    assert.deepEqual(presets.map(preset => preset.id), ['umamusume', DIRECTOR_PRESET_ID]);
    const calls = [];
    class Adapter extends LlmAdapter {
      async *stream(request) {
        calls.push(request);
        if (request.tools?.some(tool => tool.name === 'umamusume_play_scene')) {
          yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId(`director-${calls.length}`), name: 'umamusume_play_scene', arguments: JSON.stringify(twoActors) } };
          yield { type: 'finish', reason: { kind: 'tool-calls' } };
        } else {
          yield { type: 'text-delta', index: 0, text: JSON.stringify({ action: '微笑。', dialogue: '训练员，一起加油吧。', spokenText: '一緒に頑張ろう。' }) };
          yield { type: 'finish', reason: { kind: 'stop' } };
        }
      }
    }
    ctx.llm.registerAdapter(['offline-director'], new Adapter());
    handle = await ctx.agents.create({ sessionId: randomUUID(), meta: { agentPreset: DIRECTOR_PRESET_ID }, agentOptions: { provider: 'offline-director', model: 'test' }, setup: async agentCtx => {
      await agentCtx.plugin(directorPreset);
      await agentCtx.plugin(commands);
    } });
    const execute = input => ctx.commands.execute(handle.agent, `/uma ${input}`, [], AbortSignal.timeout(5000));
    const setup = { ...f.state().setup, cast: ['rice_shower', 'tokai_teio', 'mayano_top_gun', 'special_week'] };
    const saved = await execute(`story setup ${JSON.stringify(setup)}`);
    assert.equal(saved.result.kind, 'success');
    assert.deepEqual(service.directorState(handle.agent).setup, setup);
    assert.deepEqual(Object.keys(service.directorState(handle.agent).portraits), setup.cast);
    assert.deepEqual(f.saved.map(file => file.name), setup.cast.map(id => `${id}-portrait.png`));
    assert.equal(calls.length, 0, 'saving does not request a model or start the story');
    assert.equal(service.directorState(handle.agent).started, false);
    assert.equal((await execute('story continue')).result.kind, 'success');
    await handle.agent.whenIdle();
    const state = service.directorState(handle.agent);
    assert.equal(state.current.phase, 'complete', JSON.stringify(handle.agent.session.snapshotEvents().at(-3)));
    assert.equal(state.lines.filter(line => line.kind === 'dialogue').length, 2);
    assert.equal(calls.length, 3, 'one director request and one per actor; no follow-up rewrite');
    assert.deepEqual(calls[0].tools.map(tool => tool.name), ['umamusume_play_scene']);
    assert.equal(calls[1].tools.length, 0);
    assert.notEqual(calls[1].sessionId, calls[2].sessionId);
    assert.doesNotMatch(JSON.stringify(calls[1].messages), /意外暴雨/);
    assert.equal((await execute(`story setup ${JSON.stringify(setup)}`)).result.kind, 'error', 'cast and outline lock after starting');
    assert.equal((await execute('tts on')).result.kind, 'success');
    assert.equal(service.sessionState(handle.agent).ttsEnabled, true);
  } finally {
    await handle?.dispose();
    for (const fiber of loaded.reverse()) await fiber.dispose();
  }
});
