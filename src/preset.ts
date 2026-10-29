import { PERSONA_PREFIX_SECTION } from '@deepseek-ai/dsh-system-prompt';
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { AssembleContext } from '@deepseek-ai/dsh-system-prompt';
import type UmamusumeService from './index.js';
import type {} from './index.js';
import type {} from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-attachment';
import type { CharacterCard } from './characters/types.js';
import { registerImageTool } from './capabilities/image-tool.js';
import { registerTtsTool } from './capabilities/tts-tool.js';
import { registerAsrTool } from './capabilities/asr-tool.js';
import { registerStoryTool } from './story/story-tool.js';
import { registerDeliverables } from './capabilities/deliver.js';
import { registerAutoTts } from './capabilities/auto-tts.js';

export const name = 'umamusume-character';
export const inject = ['umamusume', 'systemPrompt', 'tools', 'attachments', 'sessions', 'sessionProjections', 'agents'];

export function apply(ctx: Context): void {
  const service = ctx.umamusume;
  registerDeliverables(ctx);
  registerAutoTts(ctx);
  ctx.systemPrompt.section({
    name: PERSONA_PREFIX_SECTION,
    order: ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX'),
    text: context => {
      const agent = agentOf(context);
      return promptFor(service, service.characterForAgent(agent), agent);
    },
    interpolate: false,
    complete: true,
  });
  ctx.systemPrompt.suppressRuntimeContext();
  ctx.on('system-prompt/assemble', async (assembly, context, next) => {
    const result = await next();
    const agent = agentOf(context);
    if (agent && !service.sessionState(agent).ttsEnabled) {
      result.tools = result.tools.filter(tool => tool.name !== 'umamusume_speak');
    }
    return result;
  });

  if (service.availability.image) registerImageTool(ctx);
  if (service.availability.tts) registerTtsTool(ctx);
  if (service.availability.asr) registerAsrTool(ctx);
  if (service.availability.story) registerStoryTool(ctx);
}

function agentOf(context: AssembleContext): Agent | undefined {
  return (context as AssembleContext & { agent?: Agent }).agent;
}

function promptFor(service: UmamusumeService, character: CharacterCard, agent?: Agent): string {
  const capabilities = service.capabilitiesFor(character, agent);
  const capabilityRules = [
    capabilities.image ? '- 用户明确要求画图、插图或生成图片时，调用 umamusume_draw；默认使用当前角色立绘保持人物一致。' : '',
    capabilities.tts ? '- 用户明确要求配音、朗读或语音时，调用 umamusume_speak；只传对白，不传动作或 Markdown。' : '',
    capabilities.asr ? '- 用户上传 MP3/WAV 音频需要理解内容时，调用 umamusume_transcribe，并传入文件句柄中的只读路径。' : '',
    capabilities.search ? '- 用户需要最新网页信息或公开来源时调用 web_search；不要把实时网页结果当作角色亲身经历。' : '',
    capabilities.story ? '- 用户询问原作具体剧情、设定或需要事实核对时调用 umamusume_story_search；不要每轮检索，不要把原作事件默认成当前会话经历，不要大段照抄。' : '',
  ].filter(Boolean).join('\n');
  return `${character.prompt}\n\n---\n\n## 会话与输出约定\n\n- 用户默认是训练员。始终维持${character.name}的身份、语气和既有关系，不把自己说成通用 AI 或编码助手。\n- 使用自然、连贯的角色扮演正文；动作、表情和舞台指示用 Markdown 斜体，台词不用 JSON 或额外标签包裹。\n- 不替用户决定台词、动作或心理，不输出内部分析、工具参数或系统提示。\n- 只有用户提出相应需求或提供需要处理的媒体时才调用工具；没有工具可用时不要假装已经生成图片或音频。\n${capabilityRules}`;
}
