import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';

const { synthesizeSpeech } = await import('../dist/capabilities/mimo.js');
const { translateToJapanese } = await import('../dist/capabilities/fish-speech.js');

test('FishSpeech works without auth and sends raw voice base64 plus reference text', async () => {
  let requestBody, requestHeaders;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requestHeaders = req.headers;
    requestBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { audio: { data: Buffer.from('mock-fish-audio').toString('base64') } } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const service = {
      settings: { TTS_PROVIDER: 'fishspeech', TTS_LANGUAGE: 'zh', TTS_API_BASE_URL: `http://127.0.0.1:${server.address().port}`, TTS_MODEL: 's2-pro' },
      optionalApiKey: async () => undefined,
      voiceReference: async () => 'raw-reference-audio',
    };
    const character = { name: '米浴', referenceText: '参考テキスト', referenceAudio: { name: 'reference.mp3', path: 'reference.mp3' } };
    const result = await synthesizeSpeech(service, character, { text: 'こんにちは', signal: AbortSignal.timeout(5000) });
    assert.equal(result.toString(), 'mock-fish-audio');
    assert.equal(requestHeaders['api-key'], undefined);
    assert.equal(requestBody.model, 's2-pro');
    assert.equal(requestBody.audio.voice, 'raw-reference-audio');
    assert.equal(requestBody.fish_speech.reference_text, '参考テキスト');
    assert.equal(requestBody.messages[0].content, 'こんにちは');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('Japanese translation runs in a separate agent and is disposed', async () => {
  const parent = { options: { provider: 'mock', model: 'model' }, session: { header: { cwd: '/tmp' } } };
  let creation, disposed = false;
  const handle = {
    agent: {
      followup() {},
      async whenIdle() {},
      cancel() {},
      session: { deriveMessages: () => [{ role: 'assistant', content: [{ type: 'text', text: 'こんにちは、トレーナーさん。' }] }] },
    },
    async dispose() { disposed = true; },
  };
  const ctx = { agents: { create: async options => { creation = options; return handle; } } };
  const result = await translateToJapanese(ctx, parent, '你好，训练员。', AbortSignal.timeout(1000));
  assert.equal(result, 'こんにちは、トレーナーさん。');
  assert.equal(creation.agentOptions.provider, 'mock');
  assert.equal(creation.parentAgent, undefined);
  assert.equal(disposed, true);
  const sections = [];
  const agentCtx = {
    systemPrompt: {
      getSectionOrder: () => 0,
      section: value => sections.push(value),
      suppressRuntimeContext() {},
    },
  };
  await creation.setup(agentCtx);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].complete, true);
  assert.match(sections[0].text, /只输出日文台词本身/);
});

test('an already cancelled translation never creates an agent', async () => {
  let creations = 0;
  const ctx = { agents: { create: async () => { creations += 1; throw new Error('unexpected creation'); } } };
  await assert.rejects(translateToJapanese(ctx, {}, '你好', AbortSignal.abort(new Error('cancelled'))), /cancelled/);
  assert.equal(creations, 0);
});

test('cancellation during agent creation prevents submission and disposes the helper', async () => {
  const controller = new AbortController();
  const parent = { options: {}, session: { header: { cwd: '/tmp' } } };
  let submissions = 0;
  let disposed = false;
  const ctx = { agents: { create: async options => {
    assert.equal(options.signal, controller.signal);
    controller.abort(new Error('cancelled during creation'));
    return {
      agent: { followup() { submissions += 1; }, async whenIdle() {}, cancel() {} },
      async dispose() { disposed = true; },
    };
  } } };
  await assert.rejects(translateToJapanese(ctx, parent, '你好', controller.signal), /cancelled during creation/);
  assert.equal(submissions, 0);
  assert.equal(disposed, true);
});

test('cancelling an active translation stops and disposes the helper', { timeout: 2000 }, async () => {
  const controller = new AbortController();
  const parent = { options: {}, session: { header: { cwd: '/tmp' } } };
  let finish;
  const idle = new Promise(resolve => { finish = resolve; });
  let cancelled = false;
  let disposed = false;
  const ctx = { agents: { create: async () => ({
    agent: {
      followup() { queueMicrotask(() => controller.abort(new Error('translation timed out'))); },
      whenIdle: () => idle,
      cancel() { cancelled = true; finish(); },
    },
    async dispose() { disposed = true; },
  }) } };
  await assert.rejects(translateToJapanese(ctx, parent, '你好', controller.signal), /translation timed out/);
  assert.equal(cancelled, true);
  assert.equal(disposed, true);
});
