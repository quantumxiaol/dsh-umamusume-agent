import React, { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type {} from '@deepseek-ai/dsh-client-ui-session/client';
import type {} from './state.js';
import { cgCooldownRemaining, sceneCgJobs } from './cg-policy.js';

const field: CSSProperties = { boxSizing: 'border-box', width: '100%', border: '1px solid var(--dsw-alias-border-l2, #d9dde4)', borderRadius: 8, padding: '8px 10px', background: 'var(--dsw-alias-bg-layer-1, white)', color: 'inherit', font: 'inherit' };
const button: CSSProperties = { ...field, width: 'auto', cursor: 'pointer' };
const primary: CSSProperties = { ...button, background: '#536a91', borderColor: '#536a91', color: '#fff' };
const urlFor = (path: string) => new URL(`api/file?path=${encodeURIComponent(path)}`, document.baseURI).href;

export function DirectorDock({ useProjection, useSession, execute }: PropsRuntime<'conversation.input.dock'> & { execute: (command: string) => Promise<void> }) {
  const state = useProjection('umamusumeDirector');
  const voice = useProjection('umamusume');
  const running = useSession((snapshot: { running: boolean }) => snapshot.running);
  const [title, setTitle] = useState('放学后的约定');
  const [opening, setOpening] = useState('傍晚的特雷森训练场，训练刚刚结束。训练员和大家留在看台旁，准备商量接下来的安排。');
  const [outline, setOutline] = useState('');
  const [cast, setCast] = useState<string[]>(['rice_shower']);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string>();
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [hideDialogue, setHideDialogue] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bindAudio = useCallback((element: HTMLAudioElement | null) => {
    audioRef.current?.pause();
    audioRef.current = element;
  }, []);
  const savedAudio = useRef<{ id: string; time: number; playing: boolean }>();
  const preserveAudio = () => {
    const audio = audioRef.current;
    savedAudio.current = audio?.dataset.jobId ? { id: audio.dataset.jobId, time: audio.currentTime, playing: !audio.paused && !audio.ended } : undefined;
    audio?.pause();
  };
  const closeFullscreen = () => {
    preserveAudio();
    setFullscreen(false);
  };
  useEffect(() => {
    if (!state?.setup) return;
    setTitle(state.setup.title); setOpening(state.setup.opening); setOutline(state.setup.outline); setCast(state.setup.cast);
  }, [state?.setup]);
  useEffect(() => {
    if (!state?.enabled || !state.setup) { setFullscreen(false); return; }
    if (!fullscreen) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      fullscreenButtonRef.current?.focus({ preventScroll: true });
    };
  }, [fullscreen, state?.enabled, Boolean(state?.setup)]);
  if (!state?.enabled) return null;
  const locked = busy || Boolean(running);
  const run = async (command: string) => {
    setBusy(true); setError('');
    try { await execute(command); setEditing(false); }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { setBusy(false); }
  };
  const visible = state.lines.filter(line => line.kind !== 'user');
  const requestedIndex = selected ? visible.findIndex(line => line.id === selected) : visible.length - 1;
  const index = requestedIndex >= 0 ? requestedIndex : visible.length - 1;
  const line = visible[index];
  const currentTurn = line?.turn ?? state.current.turn;
  const scene = state.scenes[String(currentTurn)] ?? state.current.scene;
  const sceneJobs = sceneCgJobs(state.cgJobs, scene, currentTurn);
  const cg = sceneJobs.filter(job => job.status === 'complete' && job.path).at(-1);
  const pendingCg = sceneJobs.at(-1);
  const cgCooldown = cgCooldownRemaining(state.cgJobs, state.current.turn);
  const audio = line ? voice?.ttsJobs.find(job => job.lineId === line.id) : undefined;
  const activeCast = state.setup?.cast ?? [];
  const editingSetup = !state.setup || (editing && !state.started);
  const selectedNames = activeCast.map(id => state.catalog.find(row => row.id === id)?.name ?? id);
  const playback = (expanded: boolean) => <>
      <div aria-label="剧情画面" style={{ position: 'relative', flex: expanded ? '1 1 auto' : undefined, minHeight: expanded ? 0 : 290, height: expanded ? undefined : 'min(42vw, 370px)', background: cg && expanded ? '#101923' : 'linear-gradient(150deg, #25364d, #556a78 60%, #b2afa1)', color: '#fff', isolation: 'isolate', overflow: 'hidden' }}>
        {cg?.path && <img src={urlFor(cg.path)} alt={cg.description} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: expanded ? 'contain' : 'cover', zIndex: -2 }} />}
        {!cg && <div style={{ position: 'absolute', inset: '15% 6% 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', zIndex: -1 }}>
          {activeCast.map(id => state.portraits[id] ? <img key={id} src={urlFor(state.portraits[id]!)} alt={state.catalog.find(character => character.id === id)?.name ?? id} style={{ minWidth: 0, maxWidth: `${90 / activeCast.length}%`, height: '100%', objectFit: 'contain', objectPosition: 'bottom', transform: expanded ? undefined : `scale(${activeCast.length > 2 ? 1.3 : 1.6})`, transformOrigin: '50% 65%', opacity: !line?.character || line.character === id ? 1 : 0.5, filter: !line?.character || line.character === id ? 'none' : 'brightness(0.75)', transition: 'opacity 180ms' }} /> : null)}
        </div>}
        <div style={{ position: 'absolute', inset: '0 0 auto', padding: '12px 16px', background: 'linear-gradient(#101923a0, transparent)', fontSize: 12 }}>
          <span>{scene.location || '故事开场'}{scene.time ? ` · ${scene.time}` : ''}</span>
          <span style={{ float: 'right', opacity: 0.85 }}>{selectedNames.join(' / ')}</span>
        </div>
        <div aria-label="剧情对白" aria-live="polite" hidden={expanded && hideDialogue} style={{ position: 'absolute', left: expanded ? 'max(16px, 5vw)' : 12, right: expanded ? 'max(16px, 5vw)' : 12, bottom: expanded ? 20 : 12, border: '1px solid #ffffff40', borderRadius: 12, padding: expanded ? '18px 24px' : '13px 16px', background: '#102034eb', boxShadow: '0 6px 24px #0003', maxHeight: expanded ? '45%' : '65%', boxSizing: 'border-box', overflowY: 'auto', fontSize: expanded ? 16 : undefined }}>
          <strong style={{ color: '#d6e3ff', display: 'block', marginBottom: 7 }}>{line?.name ?? '序幕'}</strong>
          {line?.action && <p style={{ opacity: 0.8, fontStyle: 'italic', margin: '0 0 8px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{line.action}</p>}
          <p style={{ margin: 0, fontSize: expanded ? 'clamp(16px, 1.5vw, 22px)' : 15, lineHeight: 1.8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{line?.text ?? state.setup?.opening}</p>
        </div>
      </div>
      <div aria-label="剧情播放控制" style={{ display: 'flex', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '10px 14px', maxHeight: expanded ? '35%' : undefined, boxSizing: 'border-box', overflowY: expanded ? 'auto' : undefined }}>
        <button style={button} disabled={!line || index <= 0} aria-label="上一段剧情" onClick={() => setSelected(visible[index - 1]?.id)}>‹ 上一段</button>
        <button style={button} disabled={!line || index >= visible.length - 1} aria-label="下一段剧情" onClick={() => setSelected(visible[index + 1]?.id)}>下一段 ›</button>
        {selected && <button style={button} onClick={() => setSelected(undefined)}>回到最新</button>}
        <span style={{ opacity: 0.6, flex: 1 }}>{line ? `第 ${line.turn} 轮` : '等待开场'}</span>
        <button style={primary} disabled={locked} onClick={() => { setSelected(undefined); void run('story continue'); }}>{running ? `${state.current.speaker ?? '导演'}正在回应…` : state.started ? '继续剧情' : '开始剧情'}</button>
        {audio?.status === 'complete' && audio.attachment && <audio key={audio.id} ref={bindAudio} data-job-id={audio.id} aria-label={`${line?.name}的配音`} controls preload={savedAudio.current?.id === audio.id ? 'metadata' : 'none'} onLoadedMetadata={event => {
          const saved = savedAudio.current;
          if (saved?.id !== audio.id) return;
          savedAudio.current = undefined;
          event.currentTarget.currentTime = saved.time;
          if (saved.playing) void event.currentTarget.play().catch(() => {});
        }} src={urlFor(audio.attachment.path)} style={{ height: 30, width: 'min(100%, 340px)' }} />}
        {audio && audio.status !== 'complete' && <span role={audio.status === 'error' ? 'alert' : 'status'} style={{ fontSize: 12 }}>{audio.status === 'error' ? `配音失败：${audio.error}` : '本段配音正在后台处理…'}</span>}
        {state.cgEnabled && <div role="status" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 12, width: '100%' }}>
          <span style={{ opacity: 0.8 }}>{pendingCg?.status === 'error' ? `CG 失败：${pendingCg.error}` : pendingCg?.status === 'queued' ? 'CG 已排队，文字剧情可以继续。' : pendingCg?.status === 'generating' ? 'CG 正在后台绘制，文字剧情可以继续。' : cg ? '正在展示本场景 CG。' : '本场景尚未绘制 CG。'}</span>
          {pendingCg?.status === 'error' && <button style={button} disabled={locked} onClick={() => void run(`story retry-cg ${pendingCg.id}`)}>重试这张 CG</button>}
          {!pendingCg && currentTurn === state.current.turn && <>
            <button style={button} disabled={locked || !state.imageAvailable || state.current.phase !== 'complete' || Boolean(cgCooldown)} title="绘制已发生的当前场景，不推进剧情" onClick={() => void run('story draw-cg')}>绘制当前场景</button>
            {cgCooldown > 0 && <span style={{ opacity: 0.65 }}>再推进 {cgCooldown} 轮后可绘制新 CG。</span>}
          </>}
        </div>}
      </div>
  </>;
  return <section aria-label="剧情播放" style={{ width: '100%', maxWidth: 900, maxHeight: 'min(60vh, 560px)', minHeight: 0, display: 'flex', flexDirection: 'column', margin: '0 auto 10px', boxSizing: 'border-box', border: '1px solid var(--dsw-alias-border-l2, #d9dde4)', borderRadius: 14, overflow: 'hidden', fontSize: 13 }}>
    <header style={{ display: 'flex', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '10px 14px' }}>
      <strong style={{ flex: 1 }}>剧情播放{state.setup ? ` · ${state.setup.title}` : ''}</strong>
      {state.setup && <>
        <button style={button} disabled={locked} aria-pressed={voice?.ttsEnabled} onClick={() => void run(`tts ${voice?.ttsEnabled ? 'off' : 'on'}`)}>配音 {voice?.ttsEnabled ? '开启' : '关闭'}</button>
        <button style={button} disabled={locked || !state.imageAvailable} aria-pressed={state.cgEnabled} title={state.imageAvailable ? '在关键画面后台生成 CG' : '请先配置图像 API'} onClick={() => void run(`story cg ${state.cgEnabled ? 'off' : 'on'}`)}>CG {state.cgEnabled ? '开启' : '关闭'}</button>
        {!state.started && <button style={button} disabled={locked} onClick={() => setEditing(value => !value)}>故事设置</button>}
        {!editingSetup && <button ref={fullscreenButtonRef} style={button} aria-haspopup="dialog" onClick={() => { preserveAudio(); setHideDialogue(false); setFullscreen(true); }}>全屏舞台</button>}
        <button style={button} aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)}>{collapsed ? '展开舞台' : '收起舞台'}</button>
      </>}
    </header>
    <div role="region" aria-label="剧情内容" tabIndex={0} style={{ minHeight: 0, overflowY: 'auto', overscrollBehaviorY: 'contain' }}>
    {editingSetup && <form onSubmit={event => { event.preventDefault(); void run(`story setup ${JSON.stringify({ title, opening, outline, cast })}`); }} style={{ padding: '0 14px 14px', display: 'grid', gap: 10 }}>
      <p style={{ margin: 0, opacity: 0.7 }}>向下滚动填写开场和大纲，保存后点击“开始剧情”。下方聊天框用于角色对话与行动。</p>
      <label>故事标题<input aria-label="故事标题" required maxLength={120} style={field} value={title} disabled={locked} onChange={event => setTitle(event.target.value)} /></label>
      <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend>出演角色 · {cast.length}/4</legend>
        <input aria-label="搜索出演角色" placeholder="中文名 / English / 角色 ID" style={field} value={query} onChange={event => setQuery(event.target.value)} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 132, overflowY: 'auto', marginTop: 8 }}>
          {state.catalog.filter(character => cast.includes(character.id) || `${character.name} ${character.nameEn} ${character.id}`.toLowerCase().includes(query.trim().toLowerCase())).map(character => <button key={character.id} type="button" aria-pressed={cast.includes(character.id)} disabled={!cast.includes(character.id) && cast.length >= 4} style={cast.includes(character.id) ? primary : button}
            onClick={() => setCast(ids => ids.includes(character.id) ? ids.filter(id => id !== character.id) : [...ids, character.id])}>{character.name}</button>)}
        </div>
      </fieldset>
      <label>公开开场<textarea aria-label="公开开场" required maxLength={2000} rows={2} style={{ ...field, resize: 'vertical' }} disabled={locked} value={opening} onChange={event => setOpening(event.target.value)} /></label>
      <label>剧情大纲 <span style={{ opacity: 0.65 }}>· 只给导演，不作为角色已知剧情</span><textarea aria-label="剧情大纲" maxLength={12000} rows={4} placeholder="写下想经历的冲突、转折和情绪方向；留白也可以。导演会尊重玩家选择，不强行照着大纲演。" style={{ ...field, resize: 'vertical' }} disabled={locked} value={outline} onChange={event => setOutline(event.target.value)} /></label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><button type="submit" style={primary} disabled={locked || !cast.length}>保存故事</button><span style={{ opacity: 0.65 }}>每次推进后等待玩家；开始后出演名单与大纲锁定。</span></div>
    </form>}
    {state.setup && !editingSetup && !collapsed && !fullscreen && playback(false)}
    {!!state.current.error && <div role="alert" style={{ padding: '0 14px 10px', color: '#bd4c45' }}>{state.current.error}</div>}
    {!!error && <div role="alert" style={{ padding: '0 14px 10px', color: '#bd4c45' }}>{error}</div>}
    </div>
    <dialog ref={dialogRef} aria-label="全屏剧情舞台" aria-modal="true" onCancel={event => { event.preventDefault(); closeFullscreen(); }} onClose={event => {
      // A queued close event from the previous view must not close a reopened dialog.
      if (fullscreen && !event.currentTarget.open) closeFullscreen();
    }} style={{ position: 'fixed', inset: 0, width: '100vw', height: '100dvh', maxWidth: 'none', maxHeight: 'none', margin: 0, padding: 0, border: 0, background: 'var(--dsw-alias-bg-layer-1, white)', color: 'inherit', overflow: 'hidden' }}>
      {fullscreen && <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <header style={{ display: 'flex', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '12px 16px' }}>
          <strong style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 16 }}>{state.setup?.title ?? '剧情播放'}</strong>
          <button style={button} aria-pressed={hideDialogue} onClick={() => setHideDialogue(value => !value)}>{hideDialogue ? '显示对白' : '隐藏对白'}</button>
          <button style={button} title="退出全屏舞台（Esc）" onClick={closeFullscreen}>返回对话 · Esc</button>
        </header>
        {playback(true)}
        {(state.current.error || error) && <div role="alert" style={{ flexShrink: 0, maxHeight: '15%', overflowY: 'auto', padding: '0 16px 10px', color: '#bd4c45' }}>{error || state.current.error}</div>}
      </div>}
    </dialog>
  </section>;
}
