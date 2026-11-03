import { randomUUID } from 'node:crypto';
import { Session, appendPluginRecord } from '@deepseek-ai/dsh-session';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { initialDirectorState, reduceDirectorState, SETUP_RECORD } from '../dist/director/state.js';
import { initialState, reduceState } from '../dist/state.js';

export function fixture(options = {}) {
  const session = options.session ?? Session.create(randomUUID());
  const cards = [
    { id: 'rice_shower', name: '米浴', nameEn: 'Rice Shower', prompt: '你是温柔而努力的米浴。', referenceText: 'お兄さま。', referenceAudio: { name: 'reference.mp3' }, portrait: { name: 'rice.png' } },
    { id: 'tokai_teio', name: '东海帝皇', nameEn: 'Tokai Teio', prompt: '你是自信活泼的东海帝皇。', referenceText: 'トレーナー！', referenceAudio: { name: 'reference.mp3' }, portrait: { name: 'teio.png' } },
  ];
  const calls = [];
  const saved = [];
  const effects = [];
  let turn = options.turn ?? 1;
  const settings = {
    TTS_PROVIDER: 'fishspeech', TTS_LANGUAGE: 'ja', TTS_API_BASE_URL: 'http://tts.invalid', TTS_MODEL: 's2-pro',
    GENIMG_API_BASE_URL: 'http://image.invalid/v1', GENIMG_MODEL: 'image-test',
  };
  const agent = { id: session.id, session, options: { provider: 'mock', model: 'mock-model' }, status: 'idle', followup: message => session.append('user/message', message, { surfaceOp: 'append' }) };
  const ctx = {
    sessions: { get: id => id === session.id ? session : undefined },
    sessionProjections: { stateOf: () => ({ lastTurn: turn }) },
    effect(callback) { effects.push(callback()); },
    logger: { warn() {} },
    attachments: {
      async saveFile({ data, name }) { const ref = { attachmentId: randomUUID(), name, bytes: data.length }; saved.push({ ...ref, data }); return ref; },
      fileHostPath: ref => `/tmp/${ref.attachmentId}/${ref.name}`,
    },
    umamusume: {
      characters: cards, settings,
      availability: { image: options.image ?? false, tts: true },
      character: id => { const card = cards.find(item => item.id === id); if (!card) throw new Error(`unknown character ${id}`); return card; },
      characterForAgent: () => cards[0],
      directorState: () => session.snapshotEvents().reduce(reduceDirectorState, initialDirectorState(true)),
      sessionState: () => session.snapshotEvents().reduce(reduceState, initialState(false, cards[0].id, options.tts ?? false)),
      capabilitiesFor: () => ({ tts: options.tts ?? false }),
      voiceReference: async card => `voice:${card.id}`,
      portrait: async card => Buffer.from(`portrait:${card.id}`),
      optionalApiKey: async () => undefined,
      apiKey: async () => 'offline-key',
    },
    llm: {
      async prepareCall(config) {
        return {
          config, context: { contextWindow: options.contextWindow ?? 128000 },
          async *stream(request) {
            calls.push(structuredClone({ ...request, signal: undefined }));
            const response = options.response ? await options.response(request, calls.length) : JSON.stringify({ action: '抬头微笑。', dialogue: `第 ${calls.length} 段角色台词。`, spokenText: '一緒に頑張ろう、トレーナーさん。' });
            yield { type: 'text-delta', index: 0, text: response };
            yield { type: 'usage', usage: { inputTokens: 80, outputTokens: 40, cacheReadTokens: calls.length > 2 ? 200 : 0 } };
            yield { type: 'finish', reason: { kind: options.finish ?? 'stop' } };
          },
        };
      },
    },
  };
  if (!options.session) appendPluginRecord(session, SETUP_RECORD, { setup: { title: '训练场的约定', cast: cards.map(card => card.id), opening: '傍晚，大家在训练场相遇。', outline: '秘密大纲：下一章会遇到意外暴雨。' }, portraits: {}, cgEnabled: options.image ?? false });
  return {
    ctx, agent, session, cards, calls, saved, effects,
    state: () => ctx.umamusume.directorState(agent),
    input(text, nextTurn = turn) { turn = nextTurn; agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text }] })); },
    exec(signal = AbortSignal.timeout(5000)) { return { agent, callId: `call-${turn}`, signal, concludeTurn() {} }; },
  };
}

export const twoActors = { scene: { location: '训练场', time: '傍晚' }, narration: '晚风掠过看台。', speakers: [{ character: 'rice_shower', intent: '回应训练员，表达今天训练后的感受。' }, { character: 'tokai_teio', intent: '接过米浴的话题，谈谈自己的看法。' }] };
