import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-commands';
import type {} from './index.js';

export const name = 'umamusume-commands';
export const inject = ['commands', 'umamusume'];

export function apply(ctx: Context): void {
  ctx.commands.register({
    name: 'uma',
    description: '赛马娘：在首次对话前选择角色',
    input: { hint: 'character rice_shower / character 东海帝皇 / character Tokai Teio' },
    handler: invocation => ctx.umamusume.configure(invocation),
  });
}
