import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { Session } from '@deepseek-ai/dsh-session';

const { startTtsJob, waitForTtsJobs } = await import('../dist/capabilities/tts-jobs.js');
const { initialState, reduceState, TTS_JOB_RECORD } = await import('../dist/state.js');

test('TTS job returns immediately, completes in background, and restores its state', async () => {
  const server = createServer(async (req, res) => {
    for await (const _ of req) void _;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { audio: { data: Buffer.from('background-audio').toString('base64') } } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const session = Session.create('background-test');
  const character = { id: 'rice_shower', name: '米浴', referenceAudio: { name: 'reference.mp3', path: 'reference.mp3' } };
  const agent = { id: session.id, session: new Proxy(session, {}) };
  let concluded = false;
  const ctx = {
    sessions: { get: id => id === session.id ? session : undefined },
    sessionProjections: { stateOf: () => ({ lastTurn: 7 }) },
    umamusume: {
      settings: { TTS_PROVIDER: 'mimo', TTS_API_BASE_URL: `http://127.0.0.1:${server.address().port}/v1`, TTS_MODEL: 'mimo-v2.5-tts-voiceclone', TTS_VOICE: 'mimo_default' },
      characterForAgent: () => character,
      sessionState: () => ({ ttsEnabled: true }),
      apiKey: async () => 'offline',
      voiceReference: async () => 'reference-audio',
    },
    attachments: {
      saveFile: async ({ name }) => ({ attachmentId: 'audio-id', name, bytes: 16 }),
      fileHostPath: () => '/tmp/rice_shower-speech.mp3',
    },
    effect: () => () => {},
  };
  try {
    const result = startTtsJob(ctx, { agent, callId: 'tts-call-1', concludeTurn: () => { concluded = true; } }, { text: '你好' });
    assert.equal(result.status, 'queued');
    assert.equal(concluded, true);
    await waitForTtsJobs(ctx);
    const delivered = session.snapshotEvents().filter(event => event.type === 'deliverables/presented');
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0].data.turn, 7);
    assert.equal(delivered[0].data.callId, 'tts-call-1');
    assert.equal(delivered[0].data.files[0].path, '/tmp/rice_shower-speech.mp3');
    const events = session.snapshotEvents().filter(event => event.type === TTS_JOB_RECORD);
    assert.equal(events.at(-1).data.status, 'complete');
    assert.equal(events.at(-1).data.attachment.path, '/tmp/rice_shower-speech.mp3');
    assert.ok(events.every(event => event.ignorable === true));
    let state = initialState(true, 'rice_shower');
    for (const event of events) state = reduceState(state, event);
    assert.equal(state.ttsJobs.length, 1);
    assert.equal(state.ttsJobs[0].status, 'complete');
    assert.equal(state.ttsJobs[0].character, '米浴');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
