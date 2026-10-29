import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { before, test } from 'node:test';

if (existsSync('.env')) process.loadEnvFile('.env');

const enabled = process.env.UMA_LIVE_API_TEST === '1';
const options = { skip: enabled ? false : 'Set UMA_LIVE_API_TEST=1 to run paid API tests', timeout: 300_000 };
let API_DEFAULTS, API_KEY_REFS, generateImage, synthesizeSpeech, recognizeSpeech;

before(async () => {
  ({ API_DEFAULTS, API_KEY_REFS } = await import('../dist/config.js'));
  ({ generateImage } = await import('../dist/capabilities/image.js'));
  ({ synthesizeSpeech, recognizeSpeech } = await import('../dist/capabilities/mimo.js'));
  if (!enabled) return;
  for (const key of ['GENIMG_API_KEY', 'TTS_API_KEY', 'ASR_API_KEY']) {
    assert.ok(process.env[key], `${key} is required for live tool tests`);
  }
});

function liveService() {
  const settings = Object.fromEntries(Object.keys(API_DEFAULTS).map(key => [key, process.env[key] || API_DEFAULTS[key]]));
  return {
    settings,
    async apiKey(capability) {
      const key = API_KEY_REFS[capability];
      const value = process.env[key];
      assert.ok(value, `${key} is not configured`);
      return value;
    },
    async voiceReference() {
      return (await readFile('characters/tokai_teio/reference.mp3')).toString('base64');
    },
  };
}

test('image edits returns a real image using the character portrait', options, async () => {
  const portrait = await readFile('characters/tokai_teio/ZF_Tokai-Teio.png');
  const result = await generateImage(liveService(), {
    prompt: 'Tokai Teio smiling at the training field, anime illustration',
    size: '1024x1024', quality: 'low',
    reference: { data: portrait, name: 'ZF_Tokai-Teio.png' },
    signal: AbortSignal.timeout(240_000),
  });
  assert.ok(result.data.length > 100);
  assert.match(result.mediaType, /^image\//);
});

test('MiMo voice clone returns audio for Chinese dialogue', options, async () => {
  const result = await synthesizeSpeech(liveService(), { name: '东海帝皇' }, {
    text: '训练员，今天也一起加油吧！', signal: AbortSignal.timeout(240_000),
  });
  assert.ok(result.length > 100);
});

test('MiMo ASR returns a non-empty transcript for the reference audio', options, async () => {
  const data = await readFile('characters/tokai_teio/reference.mp3');
  const result = await recognizeSpeech(liveService(), {
    data, format: 'mp3', language: 'auto', signal: AbortSignal.timeout(240_000),
  });
  assert.ok(result.text.trim().length > 0);
});
