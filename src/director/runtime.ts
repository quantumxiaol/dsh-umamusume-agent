import { randomUUID } from 'node:crypto';
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { appendPluginRecord } from '@deepseek-ai/dsh-session';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import { captureDeliveryOrigin } from '../capabilities/deliver.js';
import { queueTtsJob } from '../capabilities/tts-jobs.js';
import { queueCgJob } from './cg-jobs.js';
import { automaticCg } from './cg-policy.js';
import { performActor } from './threads.js';
import { DirectorPlan, LINE_RECORD, SETUP_RECORD, TURN_RECORD, type DirectorState, type StoryLine } from './state.js';

const running = new WeakMap<Context, Set<string>>();

export function validatePlan(value: unknown, state: DirectorState): DirectorPlan {
  const plan = DirectorPlan.parse(value);
  if (!state.setup) throw new Error('请先在剧情面板保存出演角色、开场和大纲。');
  const actors = plan.speakers.map(speaker => speaker.character);
  if (new Set(actors).size !== actors.length) throw new Error('每位角色每轮最多表演一次。');
  if (actors.some(id => !state.setup!.cast.includes(id)) || plan.cg?.characters.some(id => !state.setup!.cast.includes(id))) throw new Error('计划包含出演名单外的角色。');
  if (plan.cg && new Set(plan.cg.characters).size !== plan.cg.characters.length) throw new Error('CG 出演角色不能重复。');
  return plan;
}

export function renderStoryLines(lines: readonly StoryLine[]): string {
  return lines.filter(line => line.kind !== 'user').map(line => line.kind === 'narration'
    ? line.text
    : `【${line.name}】\n${line.action ? `*${line.action}*\n\n` : ''}${line.text}`).join('\n\n');
}

function captureInputs(ctx: Context, agent: Agent, turn: number): void {
  const session = ctx.sessions.get(agent.id)!;
  const state = ctx.umamusume.directorState(agent);
  const setupSeq = agent.session.snapshotEvents().filter(event => String(event.type) === SETUP_RECORD).at(-1)?.seq ?? -1;
  const lastSeq = Math.max(setupSeq, ...state.lines.filter(line => line.sourceSeq !== undefined).map(line => line.sourceSeq!));
  for (const event of agent.session.snapshotEvents()) {
    if (event.seq <= lastSeq || event.type !== 'user/message' || event.data.source.kind !== 'user') continue;
    const text = event.data.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
    if (!text.trim()) continue;
    appendPluginRecord(session, LINE_RECORD, { id: `user-${event.seq}`, turn, kind: 'user', name: '训练员', action: '', text, sourceSeq: event.seq });
  }
}

export async function playScene(ctx: Context, exec: ToolRunContext, value: unknown): Promise<{ text: string; turn: number }> {
  const agent = exec.agent;
  if (!agent) throw new Error('剧情工具需要当前会话。');
  const state = ctx.umamusume.directorState(agent);
  if (!state.enabled) throw new Error('请使用“剧情播放”预设。');
  const plan = validatePlan(value, state);
  const origin = captureDeliveryOrigin(ctx, agent, exec.callId);
  exec.concludeTurn();
  if (state.current.turn >= origin.turn) return { text: renderStoryLines(state.lines.filter(line => line.turn === origin.turn)) || '本轮已经执行或中断，请发送下一句继续。', turn: origin.turn };
  let active = running.get(ctx);
  if (!active) { active = new Set(); running.set(ctx, active); }
  if (active.has(agent.id)) throw new Error('当前剧情轮次仍在执行。');
  const session = ctx.sessions.get(agent.id);
  if (!session) throw new Error('当前剧情会话不可用。');
  active.add(agent.id);
  const scene = { ...state.current.scene, ...plan.scene };
  const notes: string[] = [];
  try {
    exec.signal.throwIfAborted();
    captureInputs(ctx, agent, origin.turn);
    appendPluginRecord(session, TURN_RECORD, { turn: origin.turn, scene, phase: 'acting' });
    if (plan.narration) appendPluginRecord(session, LINE_RECORD, { id: randomUUID(), turn: origin.turn, kind: 'narration', name: '旁白', action: '', text: plan.narration });
    for (const speaker of plan.speakers) {
      exec.signal.throwIfAborted();
      const character = ctx.umamusume.character(speaker.character);
      appendPluginRecord(session, TURN_RECORD, { turn: origin.turn, scene, phase: 'acting', speaker: character.name });
      const result = await performActor(ctx, agent, character, speaker.intent, origin.turn, AbortSignal.any([exec.signal, AbortSignal.timeout(120_000)]));
      if (ctx.umamusume.capabilitiesFor(character, agent).tts) {
        try { queueTtsJob(ctx, agent, { text: result.line.text, spokenText: result.spokenText, character, lineId: result.line.id }, origin); }
        catch (error) { notes.push(`${character.name}配音未能排队：${error instanceof Error ? error.message : String(error)}`); }
      }
    }
    exec.signal.throwIfAborted();
    const cg = automaticCg(ctx.umamusume.directorState(agent), plan.cg);
    if (cg) {
      try { notes.push(queueCgJob(ctx, agent, cg, origin)); }
      catch (error) { notes.push(`CG 未能排队：${error instanceof Error ? error.message : String(error)}`); }
    }
    appendPluginRecord(session, TURN_RECORD, { turn: origin.turn, scene, phase: 'complete' });
  } catch (error) {
    const message = exec.signal.aborted ? '本轮已停止，已完成的表演保留；发送下一句可继续。' : error instanceof Error ? error.message : String(error);
    appendPluginRecord(session, TURN_RECORD, { turn: origin.turn, scene, phase: 'error', error: message });
    notes.push(message);
  } finally { active.delete(agent.id); }
  const transcript = renderStoryLines(ctx.umamusume.directorState(agent).lines.filter(line => line.turn === origin.turn));
  return { turn: origin.turn, text: [transcript, ...notes].filter(Boolean).join('\n\n') || '本轮没有完成表演，请发送下一句继续。' };
}
