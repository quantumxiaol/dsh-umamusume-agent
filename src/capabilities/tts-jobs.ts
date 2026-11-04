import { randomUUID } from 'node:crypto';
import type { Context } from '@deepseek-ai/cordis';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { appendPluginRecord } from '@deepseek-ai/dsh-session';
import { ToolCallId } from '@deepseek-ai/dsh-llm';
import { TTS_JOB_RECORD, type TtsJob, type TtsJobStatus } from '../state.js';
import { ActorReply, THREAD_RECORD, ThreadRecord } from '../director/state.js';
import { synthesizeSpeech } from './mimo.js';
import { translateToJapanese } from './fish-speech.js';
import { captureDeliveryOrigin, presentDeliverable, type DeliveryOrigin } from './deliver.js';
import type { CharacterCard } from '../characters/types.js';

export interface SpeechJobInput { text: string; style?: string; spokenText?: string; character?: CharacterCard; lineId?: string }

const queues = new WeakMap<Context, Promise<void>>();
const controllers = new WeakMap<Context, Set<AbortController>>();
const cleanups = new WeakSet<Context>();

export function startTtsJob(ctx: Context, exec: ToolRunContext, input: { text: string; style?: string }): { jobId: string; status: 'queued' } {
  if (!exec.agent) throw new Error('无法访问当前会话，不能创建后台配音任务。');
  const origin = captureDeliveryOrigin(ctx, exec.agent, exec.callId);
  exec.concludeTurn();
  return queueTtsJob(ctx, exec.agent, input, origin);
}

export function queueTtsJob(ctx: Context, agent: Agent, input: SpeechJobInput, origin = captureDeliveryOrigin(ctx, agent)): { jobId: string; status: 'queued' } {
  if (!ctx.umamusume.sessionState(agent).ttsEnabled) throw new Error('本会话已关闭 TTS，请先开启后再试。');
  const character = input.character ?? ctx.umamusume.characterForAgent(agent);
  const id = randomUUID();
  const createdAt = Date.now();
  const job: TtsJob = {
    id, character: character.name, status: 'queued', createdAt, updatedAt: createdAt,
    turn: origin.turn, callId: origin.callId, ...(input.lineId ? { lineId: input.lineId } : {}),
    request: {
      characterId: character.id, text: input.text,
      ...(input.spokenText !== undefined ? { spokenText: input.spokenText } : {}),
      ...(input.style !== undefined ? { style: input.style } : {}),
    },
  };
  return enqueue(ctx, agent, character, job, origin);
}

export function retryTtsJob(ctx: Context, agent: Agent, id: string): { jobId: string; status: 'queued' } {
  const state = ctx.umamusume.sessionState(agent);
  if (!state.ttsEnabled) throw new Error('本会话已关闭 TTS，请先开启后再试。');
  const previous = state.ttsJobs.find(job => job.id === id);
  if (!previous || previous.status !== 'error') throw new Error('没有可重新生成的失败配音，任务可能已经在合成或已完成。');
  let request = previous.request;
  let turn = previous.turn;
  // Older story jobs did not persist synthesis input. Recover the committed
  // performance, including its Japanese line, without asking the actor again.
  if (!request && previous.lineId) {
    const line = ctx.umamusume.directorState(agent).lines.find(line => line.id === previous.lineId && line.kind === 'dialogue');
    if (line?.character) {
      request = { characterId: line.character, text: line.text };
      turn ??= line.turn;
      const record = agent.session.snapshotEvents().filter(event => String(event.type) === THREAD_RECORD)
        .map(event => ThreadRecord.safeParse(event.data)).find(result => result.success && result.data.line?.id === line.id);
      if (record?.success) {
        const reply = record.data.messages.filter(message => message.role === 'assistant').at(-1);
        try {
          const parsed = ActorReply.safeParse(JSON.parse(reply?.text ?? ''));
          if (parsed.success && parsed.data.dialogue === line.text) request.spokenText = parsed.data.spokenText;
        } catch { /* Missing old translation is regenerated from the public line. */ }
      }
    }
  }
  if (!request || !turn) throw new Error('这条旧配音缺少原始台词或轮次，无法重新生成。');
  const character = ctx.umamusume.character(request.characterId);
  const origin = { turn, callId: ToolCallId(previous.callId ?? randomUUID()) };
  // Replace the same job synchronously before queueing; repeated clicks cannot
  // enqueue another request or attach the result to the current story turn.
  const job: TtsJob = {
    id: previous.id, character: character.name, createdAt: previous.createdAt, updatedAt: Date.now(),
    status: 'queued', turn, callId: origin.callId, ...(previous.lineId ? { lineId: previous.lineId } : {}), request,
  };
  return enqueue(ctx, agent, character, job, origin);
}

function enqueue(ctx: Context, agent: Agent, character: CharacterCard, job: TtsJob, origin: DeliveryOrigin): { jobId: string; status: 'queued' } {
  const controller = new AbortController();
  appendTtsRecord(ctx, agent, job);
  track(ctx, controller);
  const previous = queues.get(ctx) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(() => runJob(ctx, agent, character, job, controller, origin));
  const settled = next.finally(() => {
    controllers.get(ctx)?.delete(controller);
    if (queues.get(ctx) === settled) queues.delete(ctx);
  });
  queues.set(ctx, settled);
  settled.catch(() => {});
  return { jobId: job.id, status: 'queued' };
}

export async function waitForTtsJobs(ctx: Context): Promise<void> {
  await queues.get(ctx);
}

async function runJob(ctx: Context, agent: Agent, character: CharacterCard, initial: TtsJob, controller: AbortController, origin: DeliveryOrigin): Promise<void> {
  let job = initial;
  const update = (status: TtsJobStatus, details: Partial<TtsJob> = {}) => {
    job = { ...job, ...details, status, updatedAt: Date.now() };
    appendTtsRecord(ctx, agent, job);
  };
  try {
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(600_000)]);
    signal.throwIfAborted();
    const input = { ...job.request! };
    if (ctx.umamusume.settings.TTS_PROVIDER === 'fishspeech' && ctx.umamusume.settings.TTS_LANGUAGE === 'ja' && !input.spokenText) {
      update('translating');
      input.spokenText = await translateToJapanese(ctx, agent, input.text, signal);
      job = { ...job, request: input };
    }
    update('synthesizing');
    const data = await synthesizeSpeech(ctx.umamusume, character, {
      text: input.text, spokenText: input.spokenText, style: input.style, signal,
    }, ctx, update);
    update('saving');
    const attachment = await ctx.attachments.saveFile({ data, name: `${character.id}-speech.mp3` });
    const path = presentDeliverable(ctx, agent, attachment, `${character.name} 的语音`, origin);
    update('complete', { attachment: { path, name: attachment.name } });
  } catch (error) {
    update('error', { error: error instanceof Error ? error.message : String(error) });
  }
}

function appendTtsRecord(ctx: Context, agent: Agent, job: TtsJob): void {
  const session = ctx.sessions.get(agent.id);
  if (!session) throw new Error('当前会话不可用，不能记录配音进度。');
  appendPluginRecord(session, TTS_JOB_RECORD, job);
}

function track(ctx: Context, controller: AbortController): void {
  let set = controllers.get(ctx);
  if (!set) {
    set = new Set();
    controllers.set(ctx, set);
  }
  set.add(controller);
  if (cleanups.has(ctx)) return;
  cleanups.add(ctx);
  ctx.effect(() => () => {
    for (const active of controllers.get(ctx) ?? []) active.abort(new Error('TTS plugin unloaded'));
    controllers.delete(ctx);
  });
}
