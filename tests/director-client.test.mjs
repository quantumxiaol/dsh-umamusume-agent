import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DirectorDock } from '../dist/director/client.js';
import { fixture, twoActors } from './director-fixture.mjs';
import { playScene } from '../dist/director/runtime.js';

function render(state, voice = { ttsEnabled: false, ttsJobs: [] }) {
  const f = fixture();
  return renderToStaticMarkup(React.createElement(DirectorDock, {
    useProjection: key => key === 'umamusumeDirector' ? { imageAvailable: false, ...state, catalog: f.cards } : voice,
    useSession: selector => selector({ running: false }), execute: async () => {},
  }));
}

test('story setup exposes cast, opening and outline fields without replacing the single-character UI', () => {
  const state = fixture().state();
  delete state.setup;
  const html = render(state);
  assert.match(html, /aria-label="剧情大纲"/);
  assert.match(html, /aria-label="公开开场"/);
  assert.match(html, /只给导演/);
  assert.match(html, /保存故事/);
  assert.equal(render({ ...state, enabled: false }), '');
});

test('playback displays the real speaker and public dialogue, with no hidden outline or autoplay', async () => {
  const f = fixture();
  f.input('开始');
  await playScene(f.ctx, f.exec(), twoActors);
  const html = render(f.state());
  assert.match(html, /东海帝皇/);
  assert.match(html, /第 2 段角色台词/);
  assert.match(html, /继续剧情/);
  assert.doesNotMatch(html, /秘密大纲|意外暴雨|autoPlay|autoplay/);
});

test('failed voice offers manual regeneration on its own line, and hides it while queued or complete', async () => {
  const f = fixture();
  f.input('开始');
  await playScene(f.ctx, f.exec(), twoActors);
  const state = f.state();
  const job = { id: 'voice-failed', lineId: state.lines.at(-1).id, character: '东海帝皇', status: 'error', error: '服务暂时不可用', createdAt: 1, updatedAt: 2 };
  const failed = render(state, { ttsEnabled: true, ttsJobs: [job] });
  assert.match(failed, /配音失败：服务暂时不可用/);
  assert.match(failed, /重新生成配音/);
  for (const status of ['queued', 'synthesizing', 'complete']) {
    assert.doesNotMatch(render(state, { ttsEnabled: true, ttsJobs: [{ ...job, status }] }), /重新生成配音/);
  }
  assert.doesNotMatch(render(state, { ttsEnabled: true, ttsJobs: [{ ...job, lineId: 'another-line' }] }), /重新生成配音/);
});

test('CG status distinguishes an unrequested scene, an active job and a failed job', async () => {
  const f = fixture();
  f.input('开始');
  await playScene(f.ctx, f.exec(), twoActors);
  const state = { ...f.state(), cgEnabled: true, imageAvailable: true };
  const empty = render(state);
  assert.match(empty, /本场景尚未绘制 CG/);
  assert.match(empty, /绘制当前场景/);
  const job = { id: 'cg', turn: 1, scene: state.current.scene, description: '当前场景', characters: ['rice_shower'], fingerprint: 'cg', status: 'generating' };
  const pending = render({ ...state, cgJobs: [job] });
  assert.match(pending, /CG 正在后台绘制/);
  assert.doesNotMatch(pending, /绘制当前场景/);
  const failed = render({ ...state, cgJobs: [{ ...job, status: 'error', error: '服务不可用' }] });
  assert.match(failed, /CG 失败：服务不可用/);
  assert.match(failed, /重试这张 CG/);
});

test('CG playback excludes future images and unrelated scene errors', async t => {
  const previousDocument = globalThis.document;
  globalThis.document = { baseURI: 'https://preview.invalid/' };
  t.after(() => { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; });
  const f = fixture();
  f.input('开始');
  await playScene(f.ctx, f.exec(), twoActors);
  const state = { ...f.state(), cgEnabled: true, imageAvailable: true };
  const job = { id: 'cg', turn: 1, scene: state.current.scene, description: '当前场景 CG', characters: ['rice_shower'], fingerprint: 'cg', status: 'complete', path: '/tmp/current-cg.png' };
  const ready = render({ ...state, cgJobs: [job] });
  assert.match(ready, /alt="当前场景 CG"/);
  assert.match(ready, /正在展示本场景 CG/);
  const future = render({ ...state, cgJobs: [{ ...job, turn: 2 }] });
  assert.doesNotMatch(future, /alt="当前场景 CG"/);
  const elsewhere = render({ ...state, cgJobs: [{ ...job, status: 'error', error: '旧场景错误', scene: { ...job.scene, location: '另一家店' } }] });
  assert.doesNotMatch(elsewhere, /旧场景错误|重试这张 CG/);
});
