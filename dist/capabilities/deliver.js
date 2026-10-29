import { randomUUID } from 'node:crypto';
import { ToolCallId } from '@deepseek-ai/dsh-llm';
const pending = new WeakMap();
export function registerDeliverables(ctx) {
    ctx.on('tools/result', (exec, result) => {
        const delivery = pending.get(exec);
        pending.delete(exec);
        if (!delivery || result.isError)
            return;
        delivery.session.append('deliverables/presented', {
            turn: delivery.turn,
            callId: exec.callId,
            files: delivery.files,
        });
    });
}
export function queueDeliverable(ctx, exec, attachment, description) {
    if (!exec.agent)
        throw new Error('无法访问当前会话，不能交付附件。');
    const path = attachmentPath(ctx, attachment);
    const boundary = ctx.sessionProjections.stateOf(exec.agent.session, 'turnBoundary');
    if (!boundary || boundary.openTurnStartSeq === null)
        throw new Error('当前没有打开的会话轮次，不能交付附件。');
    pending.set(exec, {
        session: exec.agent.session,
        turn: boundary.lastTurn,
        files: [{ path, description }],
    });
}
export function captureDeliveryOrigin(ctx, agent, callId = ToolCallId(randomUUID())) {
    const boundary = ctx.sessionProjections.stateOf(agent.session, 'turnBoundary');
    if (!boundary || boundary.lastTurn < 1)
        throw new Error('当前没有可关联的会话轮次，不能交付附件。');
    return { turn: boundary.lastTurn, callId };
}
export function presentDeliverable(ctx, agent, attachment, description, origin) {
    const session = ctx.sessions.get(agent.id);
    if (!session)
        throw new Error('当前会话不可用，不能交付附件。');
    const path = attachmentPath(ctx, attachment);
    session.append('deliverables/presented', { ...origin, files: [{ path, description }] });
    return path;
}
function attachmentPath(ctx, attachment) {
    const path = 'mediaType' in attachment
        ? ctx.attachments.imageHostPath(attachment)
        : ctx.attachments.fileHostPath(attachment);
    if (!path)
        throw new Error('当前附件存储不支持本机文件交付。');
    return path;
}
