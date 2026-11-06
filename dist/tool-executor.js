/** Keep native tool calls scoped to this preset/helper on both Harness APIs. */
export async function useNativeTools(ctx, allowedNames) {
    const select = (tools) => {
        if (!allowedNames)
            return tools;
        const selected = tools.filter(tool => allowedNames.includes(tool.name));
        if (selected.length !== allowedNames.length)
            throw new Error('剧情工具未能加载，请重新加载剧情播放插件后再试。');
        return selected;
    };
    if (typeof ctx.tools.presentAs === 'function') {
        ctx.tools.presentAs('native');
        if (allowedNames)
            ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
                const result = await next();
                return { ...result, tools: select(result.tools) };
            });
        return;
    }
    // Harness 0.2.2 moved tool execution into separate provider plugins. Load
    // the host's provider only here so 0.2.1 installations need no new package.
    const provider = '@deepseek-ai/dsh-tool-executor-native';
    const { NativeToolExecutor } = await import(provider);
    await ctx.plugin({
        name: 'umamusume-native-executor', inject: ['tools'],
        apply(host) {
            const native = new NativeToolExecutor(host);
            // In 0.2.2 tool schemas are provider-owned, outside the prompt waterfall.
            const tools = host.tools;
            tools.setExecutor({
                describe: definitions => native.describe(select(definitions)),
                execute: input => native.execute(input),
            });
        },
    });
}
