import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-commands';
import type {} from './index.js';

export const name = 'umamusume-commands';
export const inject = ['commands', 'umamusume'];

export function apply(ctx: Context): void {
  ctx.commands.register({
    name: 'uma',
    description: '赛马娘：角色、剧情播放与媒体设置',
    input: { hint: 'character rice_shower / tts on|off / story setup <JSON> / story cg on|off' },
    handler: invocation => ctx.umamusume.configure(invocation),
  });
}
