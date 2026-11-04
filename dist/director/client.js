import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cgCooldownRemaining, sceneCgJobs } from './cg-policy.js';
const field = { boxSizing: 'border-box', width: '100%', border: '1px solid var(--dsw-alias-border-l2, #d9dde4)', borderRadius: 8, padding: '8px 10px', background: 'var(--dsw-alias-bg-layer-1, white)', color: 'inherit', font: 'inherit' };
const button = { ...field, width: 'auto', cursor: 'pointer' };
const primary = { ...button, background: '#536a91', borderColor: '#536a91', color: '#fff' };
const urlFor = (path) => new URL(`api/file?path=${encodeURIComponent(path)}`, document.baseURI).href;
export function DirectorDock({ useProjection, useSession, execute }) {
    const state = useProjection('umamusumeDirector');
    const voice = useProjection('umamusume');
    const running = useSession((snapshot) => snapshot.running);
    const [title, setTitle] = useState('放学后的约定');
    const [opening, setOpening] = useState('傍晚的特雷森训练场，训练刚刚结束。训练员和大家留在看台旁，准备商量接下来的安排。');
    const [outline, setOutline] = useState('');
    const [cast, setCast] = useState(['rice_shower']);
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState();
    const [collapsed, setCollapsed] = useState(false);
    const [editing, setEditing] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [hideDialogue, setHideDialogue] = useState(false);
    const dialogRef = useRef(null);
    const fullscreenButtonRef = useRef(null);
    const audioRef = useRef(null);
    const bindAudio = useCallback((element) => {
        audioRef.current?.pause();
        audioRef.current = element;
    }, []);
    const savedAudio = useRef();
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
        if (!state?.setup)
            return;
        setTitle(state.setup.title);
        setOpening(state.setup.opening);
        setOutline(state.setup.outline);
        setCast(state.setup.cast);
    }, [state?.setup]);
    useEffect(() => {
        if (!state?.enabled || !state.setup) {
            setFullscreen(false);
            return;
        }
        if (!fullscreen)
            return;
        const dialog = dialogRef.current;
        dialog?.showModal();
        return () => {
            dialog?.close();
            fullscreenButtonRef.current?.focus({ preventScroll: true });
        };
    }, [fullscreen, state?.enabled, Boolean(state?.setup)]);
    if (!state?.enabled)
        return null;
    const locked = busy || Boolean(running);
    const run = async (command) => {
        setBusy(true);
        setError('');
        try {
            await execute(command);
            setEditing(false);
        }
        catch (failure) {
            setError(failure instanceof Error ? failure.message : String(failure));
        }
        finally {
            setBusy(false);
        }
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
    const playback = (expanded) => React.createElement(React.Fragment, null,
        React.createElement("div", { "aria-label": "\u5267\u60C5\u753B\u9762", style: { position: 'relative', flex: expanded ? '1 1 auto' : undefined, minHeight: expanded ? 0 : 290, height: expanded ? undefined : 'min(42vw, 370px)', background: cg && expanded ? '#101923' : 'linear-gradient(150deg, #25364d, #556a78 60%, #b2afa1)', color: '#fff', isolation: 'isolate', overflow: 'hidden' } },
            cg?.path && React.createElement("img", { src: urlFor(cg.path), alt: cg.description, style: { position: 'absolute', width: '100%', height: '100%', objectFit: expanded ? 'contain' : 'cover', zIndex: -2 } }),
            !cg && React.createElement("div", { style: { position: 'absolute', inset: '15% 6% 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', zIndex: -1 } }, activeCast.map(id => state.portraits[id] ? React.createElement("img", { key: id, src: urlFor(state.portraits[id]), alt: state.catalog.find(character => character.id === id)?.name ?? id, style: { minWidth: 0, maxWidth: `${90 / activeCast.length}%`, height: '100%', objectFit: 'contain', objectPosition: 'bottom', transform: expanded ? undefined : `scale(${activeCast.length > 2 ? 1.3 : 1.6})`, transformOrigin: '50% 65%', opacity: !line?.character || line.character === id ? 1 : 0.5, filter: !line?.character || line.character === id ? 'none' : 'brightness(0.75)', transition: 'opacity 180ms' } }) : null)),
            React.createElement("div", { style: { position: 'absolute', inset: '0 0 auto', padding: '12px 16px', background: 'linear-gradient(#101923a0, transparent)', fontSize: 12 } },
                React.createElement("span", null,
                    scene.location || '故事开场',
                    scene.time ? ` · ${scene.time}` : ''),
                React.createElement("span", { style: { float: 'right', opacity: 0.85 } }, selectedNames.join(' / '))),
            React.createElement("div", { "aria-label": "\u5267\u60C5\u5BF9\u767D", "aria-live": "polite", hidden: expanded && hideDialogue, style: { position: 'absolute', left: expanded ? 'max(16px, 5vw)' : 12, right: expanded ? 'max(16px, 5vw)' : 12, bottom: expanded ? 20 : 12, border: '1px solid #ffffff40', borderRadius: 12, padding: expanded ? '18px 24px' : '13px 16px', background: '#102034eb', boxShadow: '0 6px 24px #0003', maxHeight: expanded ? '45%' : '65%', boxSizing: 'border-box', overflowY: 'auto', fontSize: expanded ? 16 : undefined } },
                React.createElement("strong", { style: { color: '#d6e3ff', display: 'block', marginBottom: 7 } }, line?.name ?? '序幕'),
                line?.action && React.createElement("p", { style: { opacity: 0.8, fontStyle: 'italic', margin: '0 0 8px', lineHeight: 1.7, whiteSpace: 'pre-wrap' } }, line.action),
                React.createElement("p", { style: { margin: 0, fontSize: expanded ? 'clamp(16px, 1.5vw, 22px)' : 15, lineHeight: 1.8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, line?.text ?? state.setup?.opening))),
        React.createElement("div", { "aria-label": "\u5267\u60C5\u64AD\u653E\u63A7\u5236", style: { display: 'flex', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '10px 14px', maxHeight: expanded ? '35%' : undefined, boxSizing: 'border-box', overflowY: expanded ? 'auto' : undefined } },
            React.createElement("button", { style: button, disabled: !line || index <= 0, "aria-label": "\u4E0A\u4E00\u6BB5\u5267\u60C5", onClick: () => setSelected(visible[index - 1]?.id) }, "\u2039 \u4E0A\u4E00\u6BB5"),
            React.createElement("button", { style: button, disabled: !line || index >= visible.length - 1, "aria-label": "\u4E0B\u4E00\u6BB5\u5267\u60C5", onClick: () => setSelected(visible[index + 1]?.id) }, "\u4E0B\u4E00\u6BB5 \u203A"),
            selected && React.createElement("button", { style: button, onClick: () => setSelected(undefined) }, "\u56DE\u5230\u6700\u65B0"),
            React.createElement("span", { style: { opacity: 0.6, flex: 1 } }, line ? `第 ${line.turn} 轮` : '等待开场'),
            React.createElement("button", { style: primary, disabled: locked, onClick: () => { setSelected(undefined); void run('story continue'); } }, running ? `${state.current.speaker ?? '导演'}正在回应…` : state.started ? '继续剧情' : '开始剧情'),
            audio?.status === 'complete' && audio.attachment && React.createElement("audio", { key: audio.id, ref: bindAudio, "data-job-id": audio.id, "aria-label": `${line?.name}的配音`, controls: true, preload: savedAudio.current?.id === audio.id ? 'metadata' : 'none', onLoadedMetadata: event => {
                    const saved = savedAudio.current;
                    if (saved?.id !== audio.id)
                        return;
                    savedAudio.current = undefined;
                    event.currentTarget.currentTime = saved.time;
                    if (saved.playing)
                        void event.currentTarget.play().catch(() => { });
                }, src: urlFor(audio.attachment.path), style: { height: 30, width: 'min(100%, 340px)' } }),
            audio && audio.status !== 'complete' && React.createElement("span", { role: audio.status === 'error' ? 'alert' : 'status', style: { fontSize: 12 } }, audio.status === 'error' ? `配音失败：${audio.error}` : '本段配音正在后台处理…'),
            audio?.status === 'error' && React.createElement("button", { style: button, disabled: locked || !voice?.ttsEnabled, title: voice?.ttsEnabled ? '仅重新合成本段配音，不推进剧情' : '请先开启配音', onClick: () => void run(`tts retry ${audio.id}`) }, "\u91CD\u65B0\u751F\u6210\u914D\u97F3"),
            state.cgEnabled && React.createElement("div", { role: "status", style: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 12, width: '100%' } },
                React.createElement("span", { style: { opacity: 0.8 } }, pendingCg?.status === 'error' ? `CG 失败：${pendingCg.error}` : pendingCg?.status === 'queued' ? 'CG 已排队，文字剧情可以继续。' : pendingCg?.status === 'generating' ? 'CG 正在后台绘制，文字剧情可以继续。' : cg ? '正在展示本场景 CG。' : '本场景尚未绘制 CG。'),
                pendingCg?.status === 'error' && React.createElement("button", { style: button, disabled: locked, onClick: () => void run(`story retry-cg ${pendingCg.id}`) }, "\u91CD\u8BD5\u8FD9\u5F20 CG"),
                !pendingCg && currentTurn === state.current.turn && React.createElement(React.Fragment, null,
                    React.createElement("button", { style: button, disabled: locked || !state.imageAvailable || state.current.phase !== 'complete' || Boolean(cgCooldown), title: "\u7ED8\u5236\u5DF2\u53D1\u751F\u7684\u5F53\u524D\u573A\u666F\uFF0C\u4E0D\u63A8\u8FDB\u5267\u60C5", onClick: () => void run('story draw-cg') }, "\u7ED8\u5236\u5F53\u524D\u573A\u666F"),
                    cgCooldown > 0 && React.createElement("span", { style: { opacity: 0.65 } },
                        "\u518D\u63A8\u8FDB ",
                        cgCooldown,
                        " \u8F6E\u540E\u53EF\u7ED8\u5236\u65B0 CG\u3002")))));
    return React.createElement("section", { "aria-label": "\u5267\u60C5\u64AD\u653E", style: { width: '100%', maxWidth: 900, maxHeight: 'min(60vh, 560px)', minHeight: 0, display: 'flex', flexDirection: 'column', margin: '0 auto 10px', boxSizing: 'border-box', border: '1px solid var(--dsw-alias-border-l2, #d9dde4)', borderRadius: 14, overflow: 'hidden', fontSize: 13 } },
        React.createElement("header", { style: { display: 'flex', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '10px 14px' } },
            React.createElement("strong", { style: { flex: 1 } },
                "\u5267\u60C5\u64AD\u653E",
                state.setup ? ` · ${state.setup.title}` : ''),
            state.setup && React.createElement(React.Fragment, null,
                React.createElement("button", { style: button, disabled: locked, "aria-pressed": voice?.ttsEnabled, onClick: () => void run(`tts ${voice?.ttsEnabled ? 'off' : 'on'}`) },
                    "\u914D\u97F3 ",
                    voice?.ttsEnabled ? '开启' : '关闭'),
                React.createElement("button", { style: button, disabled: locked || !state.imageAvailable, "aria-pressed": state.cgEnabled, title: state.imageAvailable ? '在关键画面后台生成 CG' : '请先配置图像 API', onClick: () => void run(`story cg ${state.cgEnabled ? 'off' : 'on'}`) },
                    "CG ",
                    state.cgEnabled ? '开启' : '关闭'),
                !state.started && React.createElement("button", { style: button, disabled: locked, onClick: () => setEditing(value => !value) }, "\u6545\u4E8B\u8BBE\u7F6E"),
                !editingSetup && React.createElement("button", { ref: fullscreenButtonRef, style: button, "aria-haspopup": "dialog", onClick: () => { preserveAudio(); setHideDialogue(false); setFullscreen(true); } }, "\u5168\u5C4F\u821E\u53F0"),
                React.createElement("button", { style: button, "aria-expanded": !collapsed, onClick: () => setCollapsed(value => !value) }, collapsed ? '展开舞台' : '收起舞台'))),
        React.createElement("div", { role: "region", "aria-label": "\u5267\u60C5\u5185\u5BB9", tabIndex: 0, style: { minHeight: 0, overflowY: 'auto', overscrollBehaviorY: 'contain' } },
            editingSetup && React.createElement("form", { onSubmit: event => { event.preventDefault(); void run(`story setup ${JSON.stringify({ title, opening, outline, cast })}`); }, style: { padding: '0 14px 14px', display: 'grid', gap: 10 } },
                React.createElement("p", { style: { margin: 0, opacity: 0.7 } }, "\u5411\u4E0B\u6EDA\u52A8\u586B\u5199\u5F00\u573A\u548C\u5927\u7EB2\uFF0C\u4FDD\u5B58\u540E\u70B9\u51FB\u201C\u5F00\u59CB\u5267\u60C5\u201D\u3002\u4E0B\u65B9\u804A\u5929\u6846\u7528\u4E8E\u89D2\u8272\u5BF9\u8BDD\u4E0E\u884C\u52A8\u3002"),
                React.createElement("label", null,
                    "\u6545\u4E8B\u6807\u9898",
                    React.createElement("input", { "aria-label": "\u6545\u4E8B\u6807\u9898", required: true, maxLength: 120, style: field, value: title, disabled: locked, onChange: event => setTitle(event.target.value) })),
                React.createElement("fieldset", { disabled: locked, style: { border: 0, padding: 0, margin: 0, minWidth: 0 } },
                    React.createElement("legend", null,
                        "\u51FA\u6F14\u89D2\u8272 \u00B7 ",
                        cast.length,
                        "/4"),
                    React.createElement("input", { "aria-label": "\u641C\u7D22\u51FA\u6F14\u89D2\u8272", placeholder: "\u4E2D\u6587\u540D / English / \u89D2\u8272 ID", style: field, value: query, onChange: event => setQuery(event.target.value) }),
                    React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 132, overflowY: 'auto', marginTop: 8 } }, state.catalog.filter(character => cast.includes(character.id) || `${character.name} ${character.nameEn} ${character.id}`.toLowerCase().includes(query.trim().toLowerCase())).map(character => React.createElement("button", { key: character.id, type: "button", "aria-pressed": cast.includes(character.id), disabled: !cast.includes(character.id) && cast.length >= 4, style: cast.includes(character.id) ? primary : button, onClick: () => setCast(ids => ids.includes(character.id) ? ids.filter(id => id !== character.id) : [...ids, character.id]) }, character.name)))),
                React.createElement("label", null,
                    "\u516C\u5F00\u5F00\u573A",
                    React.createElement("textarea", { "aria-label": "\u516C\u5F00\u5F00\u573A", required: true, maxLength: 2000, rows: 2, style: { ...field, resize: 'vertical' }, disabled: locked, value: opening, onChange: event => setOpening(event.target.value) })),
                React.createElement("label", null,
                    "\u5267\u60C5\u5927\u7EB2 ",
                    React.createElement("span", { style: { opacity: 0.65 } }, "\u00B7 \u53EA\u7ED9\u5BFC\u6F14\uFF0C\u4E0D\u4F5C\u4E3A\u89D2\u8272\u5DF2\u77E5\u5267\u60C5"),
                    React.createElement("textarea", { "aria-label": "\u5267\u60C5\u5927\u7EB2", maxLength: 12000, rows: 4, placeholder: "\u5199\u4E0B\u60F3\u7ECF\u5386\u7684\u51B2\u7A81\u3001\u8F6C\u6298\u548C\u60C5\u7EEA\u65B9\u5411\uFF1B\u7559\u767D\u4E5F\u53EF\u4EE5\u3002\u5BFC\u6F14\u4F1A\u5C0A\u91CD\u73A9\u5BB6\u9009\u62E9\uFF0C\u4E0D\u5F3A\u884C\u7167\u7740\u5927\u7EB2\u6F14\u3002", style: { ...field, resize: 'vertical' }, disabled: locked, value: outline, onChange: event => setOutline(event.target.value) })),
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
                    React.createElement("button", { type: "submit", style: primary, disabled: locked || !cast.length }, "\u4FDD\u5B58\u6545\u4E8B"),
                    React.createElement("span", { style: { opacity: 0.65 } }, "\u6BCF\u6B21\u63A8\u8FDB\u540E\u7B49\u5F85\u73A9\u5BB6\uFF1B\u5F00\u59CB\u540E\u51FA\u6F14\u540D\u5355\u4E0E\u5927\u7EB2\u9501\u5B9A\u3002"))),
            state.setup && !editingSetup && !collapsed && !fullscreen && playback(false),
            !!state.current.error && React.createElement("div", { role: "alert", style: { padding: '0 14px 10px', color: '#bd4c45' } }, state.current.error),
            !!error && React.createElement("div", { role: "alert", style: { padding: '0 14px 10px', color: '#bd4c45' } }, error)),
        React.createElement("dialog", { ref: dialogRef, "aria-label": "\u5168\u5C4F\u5267\u60C5\u821E\u53F0", "aria-modal": "true", onCancel: event => { event.preventDefault(); closeFullscreen(); }, onClose: event => {
                // A queued close event from the previous view must not close a reopened dialog.
                if (fullscreen && !event.currentTarget.open)
                    closeFullscreen();
            }, style: { position: 'fixed', inset: 0, width: '100vw', height: '100dvh', maxWidth: 'none', maxHeight: 'none', margin: 0, padding: 0, border: 0, background: 'var(--dsw-alias-bg-layer-1, white)', color: 'inherit', overflow: 'hidden' } }, fullscreen && React.createElement("div", { style: { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 } },
            React.createElement("header", { style: { display: 'flex', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '12px 16px' } },
                React.createElement("strong", { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 16 } }, state.setup?.title ?? '剧情播放'),
                React.createElement("button", { style: button, "aria-pressed": hideDialogue, onClick: () => setHideDialogue(value => !value) }, hideDialogue ? '显示对白' : '隐藏对白'),
                React.createElement("button", { style: button, title: "\u9000\u51FA\u5168\u5C4F\u821E\u53F0\uFF08Esc\uFF09", onClick: closeFullscreen }, "\u8FD4\u56DE\u5BF9\u8BDD \u00B7 Esc")),
            playback(true),
            (state.current.error || error) && React.createElement("div", { role: "alert", style: { flexShrink: 0, maxHeight: '15%', overflowY: 'auto', padding: '0 16px 10px', color: '#bd4c45' } }, error || state.current.error))));
}
