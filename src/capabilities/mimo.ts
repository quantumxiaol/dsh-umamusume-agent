import type UmamusumeService from '../index.js';
import type { CharacterCard } from '../characters/types.js';
import type { Context } from '@deepseek-ai/cordis';
import { apiUrl, firstChoiceMessage, objectField, requestSignal, responseJson } from './http.js';
import { synthesizeFishSpeech } from './fish-speech.js';
import type { SpeechRecognitionInput, SpeechSynthesisInput } from './types.js';
import type { TtsJobStatus } from '../state.js';

export async function synthesizeSpeech(service: UmamusumeService, character: CharacterCard, input: SpeechSynthesisInput, context?: Context, onStage?: (status: TtsJobStatus) => void): Promise<Buffer> {
  if (service.settings.TTS_PROVIDER === 'fishspeech') return synthesizeFishSpeech(service, character, input, context, onStage);
  if (service.settings.TTS_PROVIDER !== undefined && service.settings.TTS_PROVIDER !== 'mimo') throw new Error(`未知 TTS provider：${service.settings.TTS_PROVIDER}`);
  const apiKey = await service.apiKey('tts');
  const model = service.settings.TTS_MODEL;
  const audio: Record<string, unknown> = { format: 'mp3' };
  if (model === 'mimo-v2.5-tts-voiceclone') {
    const reference = await service.voiceReference(character);
    if (reference.length > 10 * 1024 * 1024) throw new Error('参考音频的 Base64 编码超过 MiMo 的 10 MB 限制。');
    const mime = character.referenceAudio?.name.toLowerCase().endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
    audio.voice = `data:${mime};base64,${reference}`;
  } else if (model === 'mimo-v2.5-tts') audio.voice = service.settings.TTS_VOICE;
  const style = input.style?.trim() || '保持角色的年龄感、情绪和说话节奏，自然清晰地朗读。';
  onStage?.('synthesizing');
  const payload = await responseJson(await fetch(apiUrl(service.settings.TTS_API_BASE_URL, '/chat/completions'), {
    method: 'POST',
    redirect: 'error',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'dsh-umamusume-agent/0.1.0' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'user', content: `请以${character.name}的声音表演台词。${style}` },
        { role: 'assistant', content: input.text },
      ],
      audio,
      stream: false,
    }),
    signal: requestSignal(input.signal),
  }));
  const message = firstChoiceMessage(payload);
  const audioResult = message.audio;
  if (typeof audioResult !== 'object' || audioResult === null) throw new Error('MiMo TTS 响应缺少 audio。');
  const encoded = (audioResult as Record<string, unknown>).data;
  if (typeof encoded !== 'string' || !encoded) throw new Error('MiMo TTS 响应缺少音频数据。');
  const data = Buffer.from(encoded, 'base64');
  if (!data.length) throw new Error('MiMo TTS 返回了空音频。');
  return data;
}

export async function recognizeSpeech(service: UmamusumeService, input: SpeechRecognitionInput): Promise<{ text: string; seconds?: number }> {
  const apiKey = await service.apiKey('asr');
  const mime = input.format === 'mp3' ? 'audio/mpeg' : 'audio/wav';
  const payload = await responseJson(await fetch(apiUrl(service.settings.ASR_API_BASE_URL, '/chat/completions'), {
    method: 'POST',
    redirect: 'error',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'dsh-umamusume-agent/0.1.0' },
    body: JSON.stringify({
      model: service.settings.ASR_MODEL,
      messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: { data: `data:${mime};base64,${input.data.toString('base64')}`, format: input.format } }] }],
      asr_options: { language: input.language },
      stream: false,
    }),
    signal: requestSignal(input.signal),
  }));
  const message = firstChoiceMessage(payload);
  if (typeof message.content !== 'string' || !message.content.trim()) throw new Error('MiMo ASR 未返回可用转写文本。');
  const usage = objectField(payload, 'usage');
  const seconds = typeof usage === 'object' && usage !== null ? (usage as Record<string, unknown>).seconds : undefined;
  return { text: message.content.trim(), ...(typeof seconds === 'number' && Number.isFinite(seconds) ? { seconds } : {}) };
}
