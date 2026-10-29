import type { Context } from '@deepseek-ai/cordis';
import type { ContentBlock } from '@deepseek-ai/dsh-llm';
import { queueTtsJob } from './tts-jobs.js';

export function registerAutoTts(ctx: Context): void {
  const attempted = new Set<string>();
  ctx.on('agent/assistant-stream', ({ agent, frame }) => {
    if (frame.type !== 'end') return;
    const outcome = frame.outcome;
    if (outcome.kind !== 'committed' || outcome.eventType !== 'assistant/message') return;
    const state = ctx.umamusume.sessionState(agent);
    if (attempted.has(frame.attemptId) || !state.enabled || !state.ttsEnabled) return;
    const character = ctx.umamusume.characterForAgent(agent);
    if (!ctx.umamusume.capabilitiesFor(character, agent).tts) return;
    attempted.add(frame.attemptId);
    const event = agent.session.snapshotEvents().find(item => item.seq === outcome.seq && item.type === 'assistant/message');
    if (!event || event.type !== 'assistant/message') return;
    const text = dialogueForTts(event.data.message.content);
    if (!text) return;
    try { queueTtsJob(ctx, agent, { text }); }
    catch (error) { ctx.logger.warn('Automatic TTS failed to queue: %s', error instanceof Error ? error.message : String(error)); }
  });
}

export function dialogueForTts(blocks: readonly ContentBlock[]): string {
  return blocks.filter(block => block.type === 'text').map(block => block.text)
    .join('\n')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]+`/g, ' ')
    .replace(/\*\*[^*\n]+\*\*/g, ' ')
    .replace(/\*[^*\n]+\*/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^(?:[A-Za-z]:)?(?:\/|\\)[^\s]+\.(?:mp3|wav|png|jpe?g|webp|gif)$/gim, ' ')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}
