import { PERSONA_PREFIX_SECTION } from '@deepseek-ai/dsh-system-prompt';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { directorPrompt } from './prompts.js';
import { playScene } from './runtime.js';
import { useNativeTools } from '../tool-executor.js';
export const name = 'umamusume-director';
export const inject = ['umamusume', 'systemPrompt', 'tools', 'attachments', 'sessions', 'sessionProjections', 'llm'];
const PLAY_SCENE = 'umamusume_play_scene';
const SCENE_DETAIL = { oneOf: [{ type: 'string' }, { type: 'object', additionalProperties: true }] };
export async function apply(ctx) {
    ctx.systemPrompt.section({
        name: PERSONA_PREFIX_SECTION,
        order: ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX'),
        text: ({ agent }) => {
            const setup = agent ? ctx.umamusume.directorState(agent).setup : undefined;
            return directorPrompt(setup, setup?.cast.map(id => ctx.umamusume.character(id)) ?? []);
        },
        interpolate: false, complete: true,
    });
    ctx.systemPrompt.suppressRuntimeContext();
    await useNativeTools(ctx, [PLAY_SCENE]);
    // Preset tools are inherited by the live Agent. An empty allow-list on
    // the preset also hides its own tools when viewed from that child scope.
    // The scoped executor filters the model surface; this guard also blocks
    // execution of tools outside that surface without masking inheritance.
    ctx.tools.guard(exec => exec.name === PLAY_SCENE ? undefined : '剧情导演只能推进角色剧情。');
    ctx.tools.register(defineTool({
        name: PLAY_SCENE,
        description: '按导演计划推进一轮互动剧情：角色依次独立回复，后台按角色配音，并在合适时机绘制 CG。工具完成后直接等待玩家，不要再复述或追加角色台词。',
        parameters: {
            scene: {
                type: 'object', description: '首次推进填写开场地点、时间；以后只包含变化字段，不变时使用 {}。', additionalProperties: false,
                properties: { location: { type: 'string' }, time: { type: 'string' }, weather: { type: 'string' }, lighting: { type: 'string' }, atmosphere: { type: 'string' }, wardrobe: { ...SCENE_DETAIL, description: '当前服装，连续场景保持不变。可用文字（最多 1200 字），或角色 ID 到服装文字的对象；每项值必须是字符串。' }, props: { ...SCENE_DETAIL, description: '当前可见的重要道具。可用文字（最多 1200 字），或角色/位置到道具文字的对象；每项值必须是字符串。' } },
            },
            narration: { type: 'string', description: '简短的公开环境或过渡旁白，不能替角色或玩家行动。' },
            speakers: {
                type: 'array', required: true, description: '按表演顺序给出 1–3 位不重复的出演角色；通常只需 1 位。',
                items: { type: 'object', additionalProperties: false, properties: { character: { type: 'string', required: true }, intent: { type: 'string', required: true, description: '仅给出当前表演意图，不写台词、不透露未来剧情。' } } },
            },
            cg: {
                type: 'object', additionalProperties: false, description: '可选。只在开场、转场或关键画面提出，每 3 轮最多一张。',
                properties: { description: { type: 'string', required: true }, characters: { type: 'array', items: { type: 'string' }, required: true }, reason: { type: 'string', enum: ['opening', 'scene-change', 'key-moment'], required: true } },
            },
        },
        output: { schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string', required: true }, turn: { type: 'integer', required: true } } }, render: (_args, result) => [{ type: 'text', text: result.text }] },
        timeoutMs: 390_000,
        presentCall: () => ({ card: 'generic', title: '剧情播放 · 角色正在回应', kind: 'other' }),
        presentResult: (_args, result) => ({ card: 'generic', title: '剧情播放', content: result.content }),
        execute: (args, exec) => playScene(ctx, exec, args),
    }));
}
