import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendPluginRecord } from '@deepseek-ai/dsh-session';
import { fixture, twoActors } from './director-fixture.mjs';
import { playScene } from '../dist/director/runtime.js';
import { queueCgJob, waitForCgJobs } from '../dist/director/cg-jobs.js';
import { waitForTtsJobs } from '../dist/capabilities/tts-jobs.js';
import { CG_TOGGLE_RECORD } from '../dist/director/state.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zq2cAAAAASUVORK5CYII=', 'base64');
const cg = { description: '傍晚的训练场，米浴与帝皇穿训练服在看台前相视微笑。', characters: ['rice_shower', 'tokai_teio'], reason: 'opening' };

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
