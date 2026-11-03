import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendPluginRecord } from '@deepseek-ai/dsh-session';
import { fixture, twoActors } from './director-fixture.mjs';
import { playScene, validatePlan } from '../dist/director/runtime.js';
import { actorPrompt, directorPrompt, MEMORY_PROMPT } from '../dist/director/prompts.js';
import { parseActorReply, threadMessages } from '../dist/director/threads.js';
import { THREAD_RECORD, TURN_RECORD, SETUP_RECORD, LINE_RECORD, CG_RECORD, DirectorView } from '../dist/director/state.js';
import { configureDirector, recoverDirectorJobs, registerDirectorProjection } from '../dist/director/service.js';

test('director and actors have separate fixed prefixes; the outline never enters actor prompts', () => {
  const f = fixture();
  const { setup } = f.state();
  const director = directorPrompt(setup, f.cards);
  assert.match(director, /意外暴雨/);
  assert.doesNotMatch(director, /你是温柔而努力的米浴/);
  const actor = actorPrompt(f.cards[0], setup, f.cards, 'ja');
  assert.match(actor, /你是温柔而努力的米浴/);
  assert.doesNotMatch(actor, /意外暴雨|秘密大纲/);
  assert.equal(directorPrompt(structuredClone(setup), f.cards), director);
});

test('sequential actors see earlier replies; normal requests preserve the exact prefix across restart', async () => {
  const f = fixture();
  f.input('今天训练怎么样？');
  const first = await playScene(f.ctx, f.exec(), twoActors);
  assert.match(first.text, /米浴/);
  assert.match(first.text, /东海帝皇/);
  assert.equal(f.calls.length, 2);
  assert.ok(JSON.parse(f.calls[1].messages.at(-1).content[0].text).events.some(line => line.character === 'rice_shower'));
  const originalThread = structuredClone(f.state().threads.rice_shower);
  const restored = fixture({ session: f.session, turn: 2 });
  restored.input('我们一起走回宿舍吧。', 2);
  await playScene(restored.ctx, restored.exec(), { speakers: [twoActors.speakers[0]] });
  const next = restored.calls[0];
  assert.equal(next.sessionId, f.calls[0].sessionId);
  assert.equal(next.system, f.calls[0].system);
  assert.deepEqual(next.messages.slice(0, f.calls[0].messages.length), f.calls[0].messages);
  assert.deepEqual(next.messages.slice(0, originalThread.messages.length), threadMessages(originalThread.messages));
  assert.doesNotMatch(JSON.stringify(next), /意外暴雨|秘密大纲/);
  const packet = JSON.parse(next.messages.at(-1).content[0].text);
  assert.equal(packet.current_scene, undefined);
  assert.equal(packet.scene_patch, undefined);
  assert.equal(packet.events.filter(line => line.character === 'rice_shower').length, 0);
  assert.ok(packet.events.some(line => line.character === 'tokai_teio'));
  const exchanges = f.session.snapshotEvents().filter(event => String(event.type) === THREAD_RECORD && event.data.line);
  assert.equal(exchanges.length, 3);
  assert.equal(exchanges[0].data.usage.inputTokens, 80);
});

test('one user turn produces at most one bounded director plan and rejects invalid cast', async () => {
  const f = fixture();
  f.input('你好');
  assert.throws(() => validatePlan({ speakers: [twoActors.speakers[0], twoActors.speakers[0]] }, f.state()), /最多表演一次/);
  assert.throws(() => validatePlan({ speakers: [{ character: 'unknown', intent: '回复' }] }, f.state()), /名单外/);
  assert.throws(() => validatePlan({ speakers: Array(4).fill(twoActors.speakers[0]) }, f.state()));
  await playScene(f.ctx, f.exec(), twoActors);
  const before = f.session.snapshotEvents().length;
  await playScene(f.ctx, f.exec(), twoActors);
  assert.equal(f.calls.length, 2);
  assert.equal(f.session.snapshotEvents().length, before);
});

test('failed or truncated actor output stops later speakers and publishes no invented reply', async () => {
  for (const options of [{ response: () => '{"action":' }, { finish: 'max-tokens' }]) {
    const f = fixture(options);
    f.input('你好');
    await playScene(f.ctx, f.exec(), twoActors);
    assert.equal(f.calls.length, 1);
    assert.equal(f.state().current.phase, 'error');
    assert.equal(f.state().lines.filter(line => line.kind === 'dialogue').length, 0);
    assert.equal(f.ctx.umamusume.sessionState(f.agent).ttsJobs.length, 0);
  }
  assert.throws(() => parseActorReply('{"action":"","dialogue":"","spokenText":"a"}'));
});

test('cancellation preserves earlier replies and does not start later speakers', async () => {
  const controller = new AbortController();
  const f = fixture({ response: (_request, call) => {
    if (call === 2) controller.abort(new Error('stop'));
    return JSON.stringify({ action: '', dialogue: '已完成的第一句。', spokenText: 'こんにちは。' });
  } });
  f.input('开始');
  await playScene(f.ctx, f.exec(controller.signal), twoActors);
  assert.equal(f.state().current.phase, 'error');
  assert.equal(f.state().lines.filter(line => line.kind === 'dialogue').length, 1);
  assert.equal(f.state().lines.at(-1).character, 'rice_shower');
});

test('public projection excludes actor histories and resume marks unfinished jobs without regenerating', () => {
  const f = fixture();
  let projection;
  f.ctx.sessionProjections.register = definition => { projection = definition; };
  f.ctx.on = () => {};
  registerDirectorProjection(f.ctx, f.ctx.umamusume);
  appendPluginRecord(f.session, TURN_RECORD, { ...f.state().current, turn: 1, phase: 'acting' });
  appendPluginRecord(f.session, CG_RECORD, { id: 'cg', turn: 1, fingerprint: 'f', scene: f.state().current.scene, description: '训练场', characters: [], status: 'generating' });
  const view = projection.wire.view(f.state());
  DirectorView.parse(view);
  assert.equal(view.threads, undefined);
  recoverDirectorJobs(f.ctx, f.agent);
  assert.equal(f.state().current.phase, 'error');
  assert.equal(f.state().cgJobs[0].status, 'error');
  assert.equal(f.calls.length, 0);
});

test('setup locks after first user input and continue adds one native user message', async () => {
  const f = fixture();
  const setup = structuredClone(f.state().setup);
  const result = await configureDirector(f.ctx, f.agent, 'continue');
  assert.equal(result.kind, 'success');
  assert.equal(f.session.snapshotEvents().filter(event => event.type === 'user/message').length, 1);
  const changed = await configureDirector(f.ctx, f.agent, `setup ${JSON.stringify({ ...setup, title: 'changed' })}`);
  assert.equal(changed.kind, 'error');
  appendPluginRecord(f.session, SETUP_RECORD, { setup: { ...setup, title: 'forged change' }, portraits: {}, cgEnabled: false });
  assert.equal(f.state().setup.title, setup.title);
});

test('actor compaction uses only public events and changes the prefix only at a checkpoint', async () => {
  const f = fixture({ contextWindow: 24000, response: request => request.system === MEMORY_PROMPT
    ? '米浴与训练员在训练场相遇，约定一起回宿舍。'
    : JSON.stringify({ action: '', dialogue: '好呀，一起回去。', spokenText: '一緒に帰ろう。' }) });
  f.input('我们约定一起回宿舍。');
  await playScene(f.ctx, f.exec(), { speakers: [twoActors.speakers[0]] });
  const original = f.state().threads.rice_shower;
  appendPluginRecord(f.session, THREAD_RECORD, { character: 'rice_shower', messages: [{ id: 'large-private-direction', role: 'user', text: '隐藏导演意图：不要编入记忆。'.repeat(2000) }], seen: original.seen, scene: original.scene });
  f.input('走吧。', 2);
  await playScene(f.ctx, f.exec(), { speakers: [twoActors.speakers[0]] });
  const memoryCall = f.calls.find(call => call.system === MEMORY_PROMPT);
  assert.ok(memoryCall);
  assert.doesNotMatch(JSON.stringify(memoryCall.messages), /隐藏导演意图|意外暴雨/);
  assert.equal(f.state().threads.rice_shower.system, original.system);
  assert.match(f.state().threads.rice_shower.memory, /约定/);
  assert.equal(f.state().current.phase, 'complete');
});

test('failed compaction or a failed reply after compaction preserves the previous actor checkpoint', async () => {
  for (const failSummary of [true, false]) {
    const f = fixture({ contextWindow: 24000, response: (request, call) => {
      if (request.system === MEMORY_PROMPT) return failSummary ? '摘要'.repeat(3500) : '米浴和训练员约定一起回去。';
      return call === 1 ? JSON.stringify({ action: '', dialogue: '一起回去吧。', spokenText: '一緒に帰ろう。' }) : '{';
    } });
    f.input('一起回去吧。');
    await playScene(f.ctx, f.exec(), { speakers: [twoActors.speakers[0]] });
    const thread = f.state().threads.rice_shower;
    appendPluginRecord(f.session, THREAD_RECORD, { character: 'rice_shower', messages: [{ id: 'large', role: 'user', text: '旧的角色指令。'.repeat(3000) }], seen: thread.seen, scene: thread.scene });
    const before = structuredClone(f.state().threads.rice_shower);
    f.input('好。', 2);
    await playScene(f.ctx, f.exec(), { speakers: [twoActors.speakers[0]] });
    assert.equal(f.state().current.phase, 'error');
    assert.deepEqual(f.state().threads.rice_shower, before);
    assert.equal(f.state().lines.filter(line => line.kind === 'dialogue').length, 1);
  }
});

test('a long-silent actor compacts unread public history while retaining the current turn verbatim', async () => {
  const f = fixture({ contextWindow: 24000, response: request => request.system === MEMORY_PROMPT
    ? '米浴与训练员在训练场讨论训练，帝皇此前一直在旁边听。'
    : JSON.stringify({ action: '', dialogue: '我也来帮忙！', spokenText: 'ボクも手伝うよ！' }) });
  for (let i = 0; i < 100; i += 1) appendPluginRecord(f.session, LINE_RECORD, { id: `past-${i}`, turn: i + 1, kind: 'dialogue', character: 'rice_shower', name: '米浴', action: '', text: '米浴也想继续努力。'.repeat(30) });
  f.input('帝皇，你有什么想法？', 101);
  await playScene(f.ctx, f.exec(), { speakers: [twoActors.speakers[1]] });
  assert.equal(f.state().current.phase, 'complete');
  assert.ok(f.calls.some(call => call.system === MEMORY_PROMPT));
  const actorCall = f.calls.find(call => call.system !== MEMORY_PROMPT);
  const packet = JSON.parse(actorCall.messages.at(-1).content[0].text);
  assert.deepEqual(packet.events.map(line => line.text), ['帝皇，你有什么想法？']);
  assert.ok(packet.current_scene);
  assert.equal(f.state().threads.tokai_teio.memoryUntil, 100);
});
