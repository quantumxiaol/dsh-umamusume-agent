import type { Context } from '@deepseek-ai/cordis';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { searchStory } from './search.js';

export function registerStoryTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'umamusume_story_search',
    description: '检索本地保存的当前角色原作剧情，用于核对具体事件、人物关系、台词和设定。优先使用日文关键词或短语；不要用于每轮闲聊，也不要把原作事件默认成当前会话经历。',
    parameters: {
      query: { type: 'string', required: true, description: '要查找的日文或中文固定字符串，建议使用具体人物、赛事、物品或短句。' },
      max_results: { type: 'integer', description: '返回摘录组数，1–8，默认 5。' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          source: { type: 'string', required: true },
          truncated: { type: 'boolean', required: true },
          matches: {
            type: 'array', required: true,
            items: {
              type: 'object', additionalProperties: false,
              properties: { line: { type: 'number', required: true }, excerpt: { type: 'string', required: true } },
            },
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.matches.length
          ? `以下来自 ${value.source}，仅供原作事实参考：\n${value.matches.map(match => `[第 ${match.line} 行]\n${match.excerpt}`).join('\n\n')}${value.truncated ? '\n\n结果已截断，可缩小关键词继续检索。' : ''}`
          : `${value.source} 中未找到对应剧情。`,
      }],
    },
    timeoutMs: 15_000,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const character = ctx.umamusume.characterForAgent(exec.agent);
      const source = ctx.umamusume.storyFor(character);
      if (!source) throw new Error(`角色 ${character.name} 没有可用的本地剧情文件。`);
      const query = args.query.trim();
      if (!query || query.length > 200) throw new Error('检索关键词必须为 1–200 字。');
      const result = await searchStory(source, query, args.max_results ?? 5, exec.signal);
      return { source: source.relativePath, ...result };
    },
  }));
}
