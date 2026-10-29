import { defineTool } from '@deepseek-ai/dsh-tools';
import { startTtsJob } from './tts-jobs.js';
export function registerTtsTool(ctx) {
    const fish = ctx.umamusume.settings.TTS_PROVIDER === 'fishspeech';
    ctx.tools.register(defineTool({
        name: 'umamusume_speak',
        description: fish
            ? '创建后台配音任务：中文台词先翻译成日语，再用当前角色参考音频通过本机 FishSpeech 克隆音色。任务立即返回，用户可继续下一句。'
            : '创建后台配音任务，使用当前角色参考音频进行 MiMo 声音克隆。任务立即返回，用户可继续下一句。',
        parameters: {
            text: { type: 'string', required: true, description: '要合成的纯对白文本，不包含动作、Markdown 或说话人标签，最多 4000 字。' },
            style: { type: 'string', description: '可选的情绪、语速和表演要求。' },
        },
        output: {
            schema: {
                type: 'object', additionalProperties: false,
                properties: { jobId: { type: 'string', required: true }, status: { type: 'string', const: 'queued', required: true } },
            },
            render: (_args, value) => [{ type: 'text', text: `后台配音任务 ${value.jobId} 已创建，可以继续下一句；进度和音频在角色设置区显示。` }],
        },
        timeoutMs: 10_000,
        async execute(args, exec) {
            const text = args.text.trim();
            if (!text || text.length > 4000)
                throw new Error('配音文本必须为 1–4000 字。');
            return startTtsJob(ctx, exec, { text, style: args.style });
        },
    }));
}
