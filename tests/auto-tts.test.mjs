import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Session } from '@deepseek-ai/dsh-session';

const { dialogueForTts, registerAutoTts } = await import('../dist/capabilities/auto-tts.js');
const { waitForTtsJobs } = await import('../dist/capabilities/tts-jobs.js');

test('TTS text cleaner removes actions, code, markup and file paths', () => {
  const input = [
    { type: 'text', text: '**米浴**\n*脸红着低下头。*\n“你好，训练员。”\n`console.log(1)`\n[参考资料](https://example.com)\n/Users/test/audio.mp3' },
    { type: 'reasoning', text: '不应进入配音' },
  ];
  const result = dialogueForTts(input);
  assert.equal(result, '“你好，训练员。” 参考资料');
  assert.doesNotMatch(result, /脸红|console|Users|reasoning/);
});

for (const scenario of [
  { name: 'helper agents outside the roleplay preset', enabled: false, tts: true },
  { name: 'characters without an available TTS capability', enabled: true, tts: false },
]) {
  test(`automatic TTS does not queue speech for ${scenario.name}`, async () => {
    const session = Session.create(`auto-tts-${scenario.enabled}`);
    const character = { id: 'rice_shower', name: '米浴' };
    const agent = {
      id: session.id,
      session: { snapshotEvents: () => [{ seq: 1, type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'こんにちは。' }] } } }] },
    };
    let listener;
    let requests = 0;
    const ctx = {
      on: (_name, callback) => { listener = callback; },
      effect: () => () => {},
      logger: { warn() {} },
      sessions: { get: () => session },
      sessionProjections: { stateOf: () => ({ lastTurn: 1 }) },
      umamusume: {
        settings: { TTS_PROVIDER: 'mimo' },
        sessionState: () => ({ enabled: scenario.enabled, ttsEnabled: true }),
        characterForAgent: () => character,
        capabilitiesFor: () => ({ tts: scenario.tts }),
        apiKey: async () => { requests += 1; throw new Error('TTS must not be requested'); },
      },
    };
    registerAutoTts(ctx);
    listener({ agent, frame: { type: 'end', attemptId: 'reply-1', outcome: { kind: 'committed', eventType: 'assistant/message', seq: 1 } } });
    await waitForTtsJobs(ctx);
    assert.equal(requests, 0);
    assert.equal(session.snapshotEvents().filter(event => event.type.startsWith('plugin:umamusume/tts-job')).length, 0);
  });
}
