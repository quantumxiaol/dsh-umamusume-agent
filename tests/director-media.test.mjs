import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendPluginRecord } from '@deepseek-ai/dsh-session';
import { fixture, twoActors } from './director-fixture.mjs';
import { playScene } from '../dist/director/runtime.js';
import { queueCgJob, waitForCgJobs } from '../dist/director/cg-jobs.js';
import { retryTtsJob, waitForTtsJobs } from '../dist/capabilities/tts-jobs.js';
import { TTS_JOB_RECORD, TTS_TOGGLE_RECORD } from '../dist/state.js';
import { CG_TOGGLE_RECORD } from '../dist/director/state.js';
import { configureDirector } from '../dist/director/service.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zq2cAAAAASUVORK5CYII=', 'base64');
const cg = { description: '傍晚的训练场，米浴与帝皇穿训练服在看台前相视微笑。', characters: ['rice_shower', 'tokai_teio'], reason: 'opening' };

test('failed voice never blocks the story; retry after restart keeps its line, voice and original delivery', async t => {
  let available = false;
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return available
      ? Response.json({ choices: [{ message: { audio: { data: Buffer.from('voice').toString('base64') } } }] })
      : Response.json({ error: { message: 'TTS offline' } }, { status: 503 });
  });
  const f = fixture({ tts: true });
  f.input('开始');
  await playScene(f.ctx, f.exec(), twoActors);
  await waitForTtsJobs(f.ctx);
  const failed = f.ctx.umamusume.sessionState(f.agent).ttsJobs[1];
  assert.equal(failed.status, 'error');
  assert.equal(f.state().current.phase, 'complete');
  f.input('继续往前走', 2);
  await playScene(f.ctx, f.exec(), { speakers: [twoActors.speakers[0]] });
  await waitForTtsJobs(f.ctx);
  assert.equal(requests.length, 3, 'old failures are not automatically retried');
  const resumed = fixture({ session: f.session, tts: true, turn: 2 });
  const before = structuredClone(resumed.state());
  available = true;
  assert.equal(retryTtsJob(resumed.ctx, resumed.agent, failed.id).jobId, failed.id);
  assert.throws(() => retryTtsJob(resumed.ctx, resumed.agent, failed.id), /没有可重新生成/);
  await waitForTtsJobs(resumed.ctx);
  const jobs = resumed.ctx.umamusume.sessionState(resumed.agent).ttsJobs;
  assert.equal(jobs.length, 3);
  assert.equal(jobs[1].status, 'complete');
  assert.equal(jobs[1].error, undefined);
  assert.equal(jobs[1].lineId, failed.lineId);
  assert.equal(jobs[1].createdAt, failed.createdAt);
  assert.equal(jobs[0].status, 'error', 'other failures stay available for manual retry');
  assert.equal(requests.length, 4);
  assert.deepEqual(requests[3], requests[1], 'reuse the original actor voice and prepared Japanese');
  assert.deepEqual(resumed.state(), before, 'no new story lines, actor history or turns');
  assert.equal(resumed.calls.length, 0, 'no actor or director calls');
  const delivered = f.session.snapshotEvents().filter(event => event.type === 'deliverables/presented');
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].data.turn, 1);
  assert.equal(delivered[0].data.callId, failed.callId);
  assert.throws(() => retryTtsJob(resumed.ctx, resumed.agent, failed.id), /没有可重新生成/);
  assert.throws(() => retryTtsJob(resumed.ctx, resumed.agent, 'unknown'), /没有可重新生成/);
  appendPluginRecord(f.session, TTS_TOGGLE_RECORD, { version: 1, enabled: false });
  assert.throws(() => retryTtsJob(resumed.ctx, resumed.agent, jobs[0].id), /请先开启/);
});

test('legacy failed story jobs recover the committed voice text without replaying the actor', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return Response.json({ choices: [{ message: { audio: { data: Buffer.from('voice').toString('base64') } } }] });
  });
  const f = fixture();
  f.input('开始');
  await playScene(f.ctx, f.exec(), twoActors);
  const line = f.state().lines.at(-1);
  appendPluginRecord(f.session, TTS_JOB_RECORD, { id: 'legacy-failed', character: line.name, lineId: line.id, turn: line.turn, status: 'error', error: 'fetch failed', createdAt: 1000, updatedAt: 2000 });
  appendPluginRecord(f.session, TTS_TOGGLE_RECORD, { version: 1, enabled: true });
  const resumed = fixture({ session: f.session, tts: true, turn: 5 });
  retryTtsJob(resumed.ctx, resumed.agent, 'legacy-failed');
  await waitForTtsJobs(resumed.ctx);
  const job = resumed.ctx.umamusume.sessionState(resumed.agent).ttsJobs[0];
  assert.equal(job.status, 'complete', job.error);
  assert.equal(job.turn, 1);
  assert.equal(job.lineId, line.id);
  assert.equal(job.request.characterId, 'tokai_teio');
  assert.equal(requests[0].audio.voice, 'voice:tokai_teio');
  assert.equal(requests[0].messages[0].content, '一緒に頑張ろう、トレーナーさん。');
  assert.equal(resumed.calls.length, 0);
});

test('each line uses its own character voice and prepared Japanese; late audio stays on the original turn', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return Response.json({ choices: [{ message: { audio: { data: Buffer.from('voice').toString('base64') } } }] });
  });
  const f = fixture({ tts: true });
  f.input('今天怎么样？');
  await playScene(f.ctx, f.exec(), twoActors);
  f.input('准备出发吧。', 2);
  await waitForTtsJobs(f.ctx);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests.map(request => request.audio.voice), ['voice:rice_shower', 'voice:tokai_teio']);
  assert.ok(requests.every(request => request.messages[0].content === '一緒に頑張ろう、トレーナーさん。'));
  assert.equal(f.calls.length, 2, 'no extra translation model calls');
  const jobs = f.ctx.umamusume.sessionState(f.agent).ttsJobs;
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every(job => job.status === 'complete' && job.lineId && job.turn === 1));
  const deliveries = f.session.snapshotEvents().filter(event => event.type === 'deliverables/presented');
  assert.equal(deliveries.length, 2);
  assert.ok(deliveries.every(event => event.data.turn === 1));
});

test('CG runs in the background, accepts multiple portraits, and does not block the next turn', async t => {
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  let started;
  const fetching = new Promise(resolve => { started = resolve; });
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options }); started();
    await ready;
    return Response.json({ data: [{ b64_json: png.toString('base64') }] });
  });
  const f = fixture({ image: true });
  f.input('开始');
  await playScene(f.ctx, f.exec(), { ...twoActors, cg });
  await fetching;
  assert.equal(f.state().current.phase, 'complete');
  assert.equal(f.state().cgJobs[0].status, 'generating');
  f.input('一起回宿舍。', 2);
  await playScene(f.ctx, f.exec(), { speakers: [twoActors.speakers[0]] });
  assert.equal(f.state().current.turn, 2);
  assert.equal(f.state().current.phase, 'complete');
  release();
  await waitForCgJobs(f.ctx);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'http://image.invalid/v1/images/edits');
  assert.equal(requests[0].options.body.getAll('image[]').length, 2);
  assert.equal(f.state().cgJobs[0].status, 'complete');
  assert.equal(f.state().cgJobs[0].turn, 1);
  const delivery = f.session.snapshotEvents().find(event => event.type === 'deliverables/presented');
  assert.equal(delivery.data.turn, 1);
  assert.match(delivery.data.files[0].path, /story-cg-1\.png$/);
});

test('CG de-duplicates requests, enforces cooldown, and requires an explicit retry after errors', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests += 1;
    return Response.json({ error: { message: 'offline failure' } }, { status: 503 });
  });
  const f = fixture({ image: true });
  f.input('开始');
  await playScene(f.ctx, f.exec(), { ...twoActors, cg });
  await waitForCgJobs(f.ctx);
  assert.equal(requests, 1);
  assert.equal(f.state().cgJobs[0].status, 'error');
  queueCgJob(f.ctx, f.agent, cg, { turn: 4, callId: 'same' });
  queueCgJob(f.ctx, f.agent, { ...cg, description: '新的画面' }, { turn: 2, callId: 'cooldown' });
  await waitForCgJobs(f.ctx);
  assert.equal(requests, 1);
  queueCgJob(f.ctx, f.agent, cg, { turn: 1, callId: 'retry' }, f.state().cgJobs[0]);
  await waitForCgJobs(f.ctx);
  assert.equal(requests, 2);
  appendPluginRecord(f.session, CG_TOGGLE_RECORD, { enabled: false });
  queueCgJob(f.ctx, f.agent, { ...cg, description: '关闭后的画面' }, { turn: 5, callId: 'off' });
  await waitForCgJobs(f.ctx);
  assert.equal(requests, 2);
});

test('unsupported multi-reference edits falls back once; generations receive no multipart references', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, body: options.body });
    return requests.length === 1
      ? Response.json({ error: { message: 'not found' } }, { status: 404 })
      : Response.json({ data: [{ b64_json: png.toString('base64') }] });
  });
  const f = fixture({ image: true });
  f.input('开始');
  await playScene(f.ctx, f.exec(), { ...twoActors, cg });
  await waitForCgJobs(f.ctx);
  assert.deepEqual(requests.map(request => request.url), ['http://image.invalid/v1/images/edits', 'http://image.invalid/v1/images/generations']);
  assert.equal(typeof requests[1].body, 'string');
  assert.match(JSON.parse(requests[1].body).prompt, /Rice Shower/);
  assert.equal(f.state().cgJobs[0].status, 'complete');
});

test('omitted CG is filled for the opening and a scene change after cooldown, without drawing every turn', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests.push(options.body);
    return Response.json({ data: [{ b64_json: png.toString('base64') }] });
  });
  const f = fixture({ image: true });
  f.input('开始');
  await playScene(f.ctx, f.exec(), twoActors);
  await waitForCgJobs(f.ctx);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].getAll('image[]').length, 2);
  assert.doesNotMatch(requests[0].get('prompt'), /秘密大纲|意外暴雨/);
  for (let turn = 2; turn <= 5; turn += 1) {
    f.input('继续', turn);
    await playScene(f.ctx, f.exec(), { scene: turn === 2 ? { location: '甜点店' } : {}, speakers: twoActors.speakers });
    await waitForCgJobs(f.ctx);
    assert.equal(requests.length, turn < 4 ? 1 : 2);
  }
  assert.deepEqual(f.state().cgJobs.map(job => [job.turn, job.scene.location, job.status]), [[1, '训练场', 'complete'], [4, '甜点店', 'complete']]);
});

test('manual drawing fills an existing scene without advancing dialogue or issuing duplicate requests', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests += 1;
    return Response.json({ data: [{ b64_json: png.toString('base64') }] });
  });
  const f = fixture({ image: true });
  assert.equal((await configureDirector(f.ctx, f.agent, 'draw-cg')).kind, 'error');
  await configureDirector(f.ctx, f.agent, 'cg off');
  f.input('开始');
  await playScene(f.ctx, f.exec(), twoActors);
  await waitForCgJobs(f.ctx);
  assert.equal(requests, 0, 'CG off prevents automatic drawings');
  const lines = structuredClone(f.state().lines);
  const calls = f.calls.length;
  await configureDirector(f.ctx, f.agent, 'cg on');
  assert.equal((await configureDirector(f.ctx, f.agent, 'draw-cg')).kind, 'success');
  await configureDirector(f.ctx, f.agent, 'draw-cg');
  await waitForCgJobs(f.ctx);
  assert.equal(requests, 1);
  assert.equal(f.calls.length, calls);
  assert.deepEqual(f.state().lines, lines);
  assert.equal(f.state().cgJobs[0].turn, 1);
  assert.equal(f.state().cgJobs[0].status, 'complete');
  assert.equal(f.session.snapshotEvents().filter(event => event.type === 'deliverables/presented').at(-1).data.turn, 1);
});

test('a failed automatic CG is not retried on later dialogue turns or the draw button', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests += 1;
    return Response.json({ error: { message: 'offline failure' } }, { status: 503 });
  });
  const f = fixture({ image: true });
  f.input('开始');
  await playScene(f.ctx, f.exec(), twoActors);
  await waitForCgJobs(f.ctx);
  f.input('继续', 5);
  await playScene(f.ctx, f.exec(), { speakers: twoActors.speakers });
  await waitForCgJobs(f.ctx);
  const result = await configureDirector(f.ctx, f.agent, 'draw-cg');
  assert.equal(result.kind, 'error');
  assert.match(result.text, /重试/);
  assert.equal(requests, 1);
});
