import React, { useState, type CSSProperties } from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type {} from '@deepseek-ai/dsh-client-ui-session/client';
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type {} from '@deepseek-ai/dsh-client-ui-chat/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from './state.js';

type Controls = { execute: (command: string) => Promise<void> };

const control: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l2, #d9dde4)', borderRadius: 8,
  padding: '6px 9px', background: 'var(--dsw-alias-bg-layer-1, white)', color: 'inherit', font: 'inherit',
};

const statusText = {
  queued: '排队等待', translating: '正在翻译', synthesizing: '正在合成', saving: '正在保存附件', complete: '合成完成', error: '合成失败',
} as const;

function TtsProgress({ job }: { job?: import('./state.js').TtsJob }) {
  if (!job) return null;
  const pending = job.status !== 'complete' && job.status !== 'error';
  const url = job.attachment ? new URL(`api/file?path=${encodeURIComponent(job.attachment.path)}`, document.baseURI).href : undefined;
  return <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, width: '100%', fontSize: 12 }}>
    <span>{job.character} · {statusText[job.status]}</span>
    {pending && <progress aria-label="语音合成进行中" style={{ width: 120, height: 8 }} />}
    {job.status === 'complete' && url && <>
      <audio aria-label="生成的语音" controls preload="none" src={url} style={{ height: 30, maxWidth: 360 }} />
      <a href={url} download={job.attachment!.name} style={{ color: 'inherit' }}>下载 MP3</a>
    </>}
    {job.status === 'error' && <span role="alert" style={{ color: '#c43b3b' }}>{job.error}</span>}
  </div>;
}

function CharacterDock({ useProjection, useSession, execute }: PropsRuntime<'conversation.input.dock'> & Controls) {
  const state = useProjection('umamusume');
  const running = useSession((snapshot: { running: boolean }) => snapshot.running);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!state?.enabled) return null;

  const locked = state.started || Boolean(running) || busy;
  const normalized = query.trim().toLowerCase();
  const filtered = state.catalog.filter(character => !normalized
    || character.name.toLowerCase().includes(normalized)
    || character.nameEn.toLowerCase().includes(normalized)
    || character.id.toLowerCase().includes(normalized));
  const current = state.catalog.find(character => character.id === state.character);
  const options = current && !filtered.some(character => character.id === current.id) ? [current, ...filtered] : filtered;

  const run = async (command: string) => {
    setError('');
    setBusy(true);
    try { await execute(command); }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { setBusy(false); }
  };
  const select = (character: string) => run(`character ${character}`);

  return <section aria-label="赛马娘角色设置" style={{
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
    width: '100%', maxWidth: 820, boxSizing: 'border-box', margin: '0 auto 8px',
    padding: '8px 12px', fontSize: 13,
  }}>
    <strong>赛马娘</strong>
    <input aria-label="搜索角色" placeholder="搜索角色（中文 / English）" value={query} disabled={locked}
      onChange={event => setQuery(event.target.value)} style={{ ...control, minWidth: 180, flex: '1 1 220px' }} />
    <select aria-label="当前角色" value={state.character} disabled={locked} onChange={event => void select(event.target.value)}
      title={state.started ? '角色已锁定，更换角色请新建会话' : '第一条消息前可更换角色'} style={{ ...control, maxWidth: 240 }}>
      {options.map(character => <option key={character.id} value={character.id}>{character.name} / {character.nameEn}</option>)}
    </select>
    <button type="button" aria-label="切换本会话 TTS" aria-pressed={state.ttsEnabled} disabled={busy || Boolean(running)}
      onClick={() => void run(state.ttsEnabled ? 'tts off' : 'tts on')} style={control}>
      TTS {state.ttsEnabled ? '开启' : '关闭'}
    </button>
    <span style={{ opacity: 0.65, fontSize: 12 }}>{state.started ? '角色已锁定' : '第一条消息前可更换'}</span>
    <TtsProgress job={state.ttsJobs.at(-1)} />
    {!!error && <span role="alert" style={{ color: '#c43b3b', width: '100%' }}>{error}</span>}
  </section>;
}

export const inject = ['slots', 'remote', 'remote.commands'];

export function apply(ctx: Context): void {
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock', id: 'umamusume', order: 20,
    inject: sessionId => ({
      execute: async (command: string) => {
        const result = await ctx.remote.commands.execute(sessionId, `/uma ${command}`, []);
        if (!result.ok) throw new Error(result.error.message);
        if (!result.value) throw new Error('请先选择“赛马娘”会话预设。');
        if (result.value.result.kind === 'error') throw new Error(result.value.result.text);
      },
    }),
  }, CharacterDock));
}
