import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { Context } from '@deepseek-ai/cordis';
import Sessions, { appendPluginRecord } from '@deepseek-ai/dsh-session';
import Projections from '@deepseek-ai/dsh-session-projection';
import Agents from '@deepseek-ai/dsh-agent';
import AgentLoop from '@deepseek-ai/dsh-agent-loop';
import Llm, { LlmAdapter, ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import Tools from '@deepseek-ai/dsh-tools';
import { apply as directorPreset } from '../dist/director/preset.js';
import { registerDirectorProjection } from '../dist/director/service.js';
import { DIRECTOR_PRESET_ID, SETUP_RECORD } from '../dist/director/state.js';
import { fixture, twoActors } from './director-fixture.mjs';

test('native Harness loop executes one director tool and two actor calls without a narrator rewrite', { timeout: 10000 }, async () => {
  const ctx = new Context();
  const loaded = [];
  let handle;
  try {
    for (const plugin of [Projections, Sessions, Agents, Llm, SystemPrompt, Tools, AgentLoop]) loaded.push(await ctx.plugin(plugin, {}));
    const f = fixture();
    const service = {
      ...f.ctx.umamusume,
      directorState: agent => ctx.sessionProjections.stateOf(agent.session, 'umamusumeDirector'),
      sessionState: () => ({ ttsEnabled: false, ttsJobs: [] }),
      capabilitiesFor: () => ({ tts: false }),
    };
    ctx.provide('umamusume', service);
    ctx.provide('attachments', f.ctx.attachments);
    registerDirectorProjection(ctx, service);
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
    handle = await ctx.agents.create({ sessionId: randomUUID(), meta: { agentPreset: DIRECTOR_PRESET_ID }, agentOptions: { provider: 'offline-director', model: 'test' }, setup: agentCtx => { directorPreset(agentCtx); } });
    appendPluginRecord(ctx.sessions.get(handle.agent.id), SETUP_RECORD, { setup: f.state().setup, portraits: {}, cgEnabled: false });
    handle.agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '今天训练怎么样？' }] }));
    await handle.agent.whenIdle();
    const state = service.directorState(handle.agent);
    assert.equal(state.current.phase, 'complete', JSON.stringify(handle.agent.session.snapshotEvents().at(-3)));
    assert.equal(state.lines.filter(line => line.kind === 'dialogue').length, 2);
    assert.equal(calls.length, 3, 'one director request and one per actor; no follow-up rewrite');
    assert.deepEqual(calls[0].tools.map(tool => tool.name), ['umamusume_play_scene']);
    assert.equal(calls[1].tools.length, 0);
    assert.notEqual(calls[1].sessionId, calls[2].sessionId);
    assert.doesNotMatch(JSON.stringify(calls[1].messages), /意外暴雨/);
  } finally {
    await handle?.dispose();
    for (const fiber of loaded.reverse()) await fiber.dispose();
  }
});
