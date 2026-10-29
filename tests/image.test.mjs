import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';

const { generateImage } = await import('../dist/capabilities/image.js');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zq2cAAAAASUVORK5CYII=', 'base64');

function settings(port) {
  return { GENIMG_API_BASE_URL: `http://127.0.0.1:${port}/v1`, GENIMG_MODEL: 'gpt-image-2.5' };
}

test('unsupported edits falls back to generations with a text character description', async () => {
  const paths = [];
  let generationBody;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    paths.push(req.url);
    if (req.url === '/v1/images/edits') {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'not found' } }));
      return;
    }
    generationBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await generateImage({ settings: settings(server.address().port), apiKey: async () => 'test' }, {
      prompt: '花园中的米浴', referenceDescription: '米浴，保持外观',
      reference: { data: png, name: 'reference.png' }, size: '1024x1024', quality: 'low', signal: AbortSignal.timeout(5000),
    });
    assert.equal(result.mediaType, 'image/png');
    assert.deepEqual(paths, ['/v1/images/edits', '/v1/images/generations']);
    assert.match(generationBody.prompt, /米浴，保持外观/);
    assert.equal(generationBody.model, 'gpt-image-2.5');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('other HTTP errors do not trigger a second paid request', async () => {
  let calls = 0;
  const server = createServer((req, res) => {
    calls += 1;
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Token失效' } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await assert.rejects(generateImage({ settings: settings(server.address().port), apiKey: async () => 'test' }, {
      prompt: 'test', reference: { data: png, name: 'reference.png' }, size: '1024x1024', quality: 'low', signal: AbortSignal.timeout(5000),
    }), /Token失效/);
    assert.equal(calls, 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
