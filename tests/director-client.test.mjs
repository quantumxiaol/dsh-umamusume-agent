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
    useProjection: key => key === 'umamusumeDirector' ? { ...state, catalog: f.cards, imageAvailable: false } : voice,
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
