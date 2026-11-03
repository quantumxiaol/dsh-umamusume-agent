import assert from 'node:assert/strict';
import { test } from 'node:test';

const { initialState, reduceState, CHARACTER_RECORD, TTS_TOGGLE_RECORD, TTS_JOB_RECORD } = await import('../dist/state.js');

function selected(agentPreset) {
  return { type: 'agent-preset/selected', data: { agentPreset } };
}

function characterRecord(character) {
  return { type: CHARACTER_RECORD, ignorable: true, data: { version: 1, character } };
}

test('character selection is scoped to the Umamusume preset and persists before the first message', () => {
  let state = initialState(false, 'rice_shower');
  assert.equal(state.enabled, false);
  state = reduceState(state, selected('umamusume'));
  assert.equal(state.enabled, true);
  state = reduceState(state, characterRecord('tokai_teio'));
  assert.equal(state.character, 'tokai_teio');
  assert.equal(state.started, false);
});

test('first human message locks the character and later selection records are ignored', () => {
  let state = reduceState(initialState(true, 'rice_shower'), characterRecord('tokai_teio'));
  state = reduceState(state, { type: 'user/message', data: { source: { kind: 'user' } } });
  assert.equal(state.started, true);
  const locked = reduceState(state, characterRecord('special_week'));
  assert.equal(locked, state);
  assert.equal(locked.character, 'tokai_teio');
});

test('other presets and non-human messages do not enable or lock the roleplay state', () => {
  let state = initialState(false, 'rice_shower');
  state = reduceState(state, selected('standard'));
  state = reduceState(state, { type: 'user/message', data: { source: { kind: 'runtime-context' } } });
  assert.equal(state.enabled, false);
  assert.equal(state.started, false);
});

test('TTS toggle from a proxied session persists after the character is locked', () => {
  let state = initialState(true, 'rice_shower', true);
  state = reduceState(state, { type: 'user/message', data: { source: { kind: 'user' } } });
  state = reduceState(state, { type: TTS_TOGGLE_RECORD, ignorable: true, data: { version: 1, enabled: false } });
  assert.equal(state.ttsEnabled, false);
  state = reduceState(state, { type: TTS_TOGGLE_RECORD, ignorable: true, data: { version: 1, enabled: true } });
  assert.equal(state.ttsEnabled, true);
  state = reduceState(state, { type: TTS_TOGGLE_RECORD, ignorable: true, data: { version: 1, enabled: false } });
  assert.equal(state.ttsEnabled, false);
});

test('an older voice job finishing does not replace the latest queued job in the dock', () => {
  let state = initialState(true, 'rice_shower');
  const first = { id: 'a', character: '米浴', status: 'queued', createdAt: 1000, updatedAt: 1000 };
  const second = { ...first, id: 'b', character: '东海帝皇' };
  for (const job of [first, second, { ...first, status: 'complete', updatedAt: 2000 }]) {
    state = reduceState(state, { type: TTS_JOB_RECORD, ignorable: true, data: job });
  }
  assert.equal(state.ttsJobs.at(-1).id, 'b');
  assert.equal(state.ttsJobs[0].status, 'complete');
});
