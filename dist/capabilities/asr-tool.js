import { resolve } from 'node:path';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { MAX_ASR_BYTES } from '../config.js';
import { recognizeSpeech } from './mimo.js';
export function registerAsrTool(ctx) {
    ctx.tools.register(defineTool({
        name: 'umamusume_transcribe',
        description: '使用 MiMo 转写用户在本会话上传的 MP3/WAV 音频。path 必须原样使用文件句柄提供的只读路径，不能转写任意本机文件。',
        parameters: {
            path: { type: 'string', required: true, description: '本会话音频 File 句柄中的完整只读路径。' },
            language: { type: 'string', enum: ['auto', 'zh', 'en'], description: '识别语种，默认 auto。' },
        },
        output: {
            schema: {
                type: 'object', additionalProperties: false,
                properties: { text: { type: 'string', required: true }, seconds: { type: 'number' } },
            },
            render: (_args, value) => [{ type: 'text', text: `语音转写：${value.text}` }],
        },
        timeoutMs: 190_000,
        async execute(args, exec) {
            if (!exec.agent)
                throw new Error('无法访问当前会话附件。');
            const found = findAudioAttachment(ctx.attachments, exec.agent, args.path);
            const format = audioFormat(found);
            const data = await readAttachment(ctx.attachments, found, exec.signal);
            return recognizeSpeech(ctx.umamusume, { data, format, language: args.language ?? 'auto', signal: exec.signal });
        },
    }));
}
function findAudioAttachment(attachments, agent, path) {
    const normalized = resolve(path);
    for (const message of agent.session.deriveMessages()) {
        if (message.role !== 'user' || !Array.isArray(message.content))
            continue;
        for (const block of message.content) {
            if (block.type !== 'file')
                continue;
            const hostPath = attachments.fileHostPath(block.attachment);
            if (hostPath && resolve(hostPath) === normalized)
                return block.attachment;
        }
    }
    throw new Error('该路径不属于本会话可访问的附件。');
}
function audioFormat(ref) {
    const extension = ref.name.toLowerCase().split('.').at(-1);
    if (extension === 'mp3' || extension === 'wav')
        return extension;
    throw new Error('MiMo ASR 仅支持扩展名为 .mp3 或 .wav 的音频。');
}
async function readAttachment(attachments, ref, signal) {
    if (ref.bytes > MAX_ASR_BYTES)
        throw new Error('音频超过 25 MB 限制。');
    const chunks = [];
    let size = 0;
    for await (const chunk of attachments.readFileStream(ref, signal)) {
        size += chunk.byteLength;
        if (size > MAX_ASR_BYTES)
            throw new Error('音频超过 25 MB 限制。');
        chunks.push(Buffer.from(chunk));
    }
    const data = Buffer.concat(chunks);
    if (ref.name.toLowerCase().endsWith('.wav')) {
        if (data.length < 12 || data.subarray(0, 4).toString() !== 'RIFF' || data.subarray(8, 12).toString() !== 'WAVE')
            throw new Error('音频内容不是有效 WAV。');
    }
    else if (data.length < 3 || (data.subarray(0, 3).toString() !== 'ID3' && !(data[0] === 0xff && (data[1] & 0xe0) === 0xe0))) {
        throw new Error('音频内容不是有效 MP3。');
    }
    return data;
}
