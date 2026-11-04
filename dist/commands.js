export const name = 'umamusume-commands';
export const inject = ['commands', 'umamusume'];
export function apply(ctx) {
    ctx.commands.register({
        name: 'uma',
        description: '赛马娘：角色、剧情播放与媒体设置',
        input: { hint: 'character rice_shower / tts on|off / tts retry <任务ID> / story setup <JSON> / story cg on|off' },
        handler: invocation => ctx.umamusume.configure(invocation),
    });
}
