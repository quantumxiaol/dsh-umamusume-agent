import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';

const { synthesizeSpeech } = await import('../dist/capabilities/mimo.js');

function service(baseUrl) {
  return {
    settings: { TTS_API_BASE_URL: baseUrl, TTS_MODEL: 'mimo-v2.5-tts-voiceclone', TTS_VOICE: 'mimo_default' },
    apiKey: async () => 'offline-key',
    voiceReference: async () => 'reference-audio',
  };
}

const character = { name: '米浴', referenceAudio: { name: 'reference.mp3', path: 'reference.mp3' } };

test('voice clone sends a complete MP3 data URI', async () => {
  let requestBody;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requestBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { audio: { data: Buffer.from('mock-audio').toString('base64') } } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
    const result = await synthesizeSpeech(service(baseUrl), character, { text: '你好', signal: AbortSignal.timeout(5000) });
    assert.equal(result.toString(), 'mock-audio');
    assert.equal(requestBody.audio.voice, 'data:audio/mpeg;base64,reference-audio');
    assert.equal(requestBody.audio.format, 'mp3');
    assert.equal(requestBody.messages[1].content, '你好');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('HTTP 429 tells the agent not to retry immediately', async () => {
  const server = createServer((req, res) => {
    res.writeHead(429, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Too many requests' } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
    await assert.rejects(
      synthesizeSpeech(service(baseUrl), character, { text: '你好', signal: AbortSignal.timeout(5000) }),
      /请勿立即重试/,
    );
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
