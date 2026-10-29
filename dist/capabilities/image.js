import { MAX_IMAGE_BYTES } from '../config.js';
import { ApiHttpError, apiUrl, objectField, requestSignal, responseJson } from './http.js';
export async function generateImage(service, input) {
    try {
        return await requestImage(service, input);
    }
    catch (error) {
        if (!input.reference || !(error instanceof ApiHttpError) || error.status !== 404)
            throw error;
        const prompt = input.referenceDescription ? `${input.referenceDescription}\n${input.prompt}` : input.prompt;
        return requestImage(service, { ...input, prompt, reference: undefined });
    }
}
async function requestImage(service, input) {
    const apiKey = await service.apiKey('image');
    const { GENIMG_API_BASE_URL: baseUrl, GENIMG_MODEL: model } = service.settings;
    const headers = { authorization: `Bearer ${apiKey}`, accept: 'application/json', 'user-agent': 'dsh-umamusume-agent/0.1.0' };
    let body;
    if (input.reference) {
        const form = new FormData();
        form.set('model', model);
        form.set('prompt', input.prompt);
        form.set('n', '1');
        form.set('size', input.size);
        form.set('quality', input.quality);
        form.set('response_format', 'b64_json');
        form.set('image', new Blob([Uint8Array.from(input.reference.data)], { type: 'image/png' }), input.reference.name);
        body = form;
    }
    else {
        headers['content-type'] = 'application/json';
        body = JSON.stringify({ model, prompt: input.prompt, n: 1, size: input.size, quality: input.quality, response_format: 'b64_json' });
    }
    const response = await fetch(apiUrl(baseUrl, input.reference ? '/images/edits' : '/images/generations'), {
        method: 'POST', redirect: 'error', headers, body, signal: requestSignal(input.signal),
    });
    const payload = await responseJson(response);
    const data = objectField(payload, 'data');
    if (!Array.isArray(data) || !data.length)
        throw new Error('图像 API 未返回图片。');
    const item = data[0];
    if (typeof item.b64_json === 'string' && item.b64_json)
        return decodeImage(Buffer.from(item.b64_json, 'base64'));
    if (typeof item.url === 'string' && item.url) {
        const imageResponse = await fetch(item.url, { redirect: 'follow', signal: requestSignal(input.signal) });
        if (!imageResponse.ok)
            throw new Error(`下载生成图片失败（HTTP ${imageResponse.status}）。`);
        const length = Number(imageResponse.headers.get('content-length') ?? 0);
        if (length > MAX_IMAGE_BYTES)
            throw new Error('生成图片超过 32 MB 限制。');
        return decodeImage(Buffer.from(await imageResponse.arrayBuffer()));
    }
    throw new Error('图像 API 响应缺少 b64_json 或 url。');
}
function decodeImage(data) {
    if (!data.length || data.length > MAX_IMAGE_BYTES)
        throw new Error('生成图片为空或超过 32 MB 限制。');
    if (data.length >= 8 && data[0] === 0x89 && data.subarray(1, 4).toString() === 'PNG')
        return { data, mediaType: 'image/png' };
    if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff)
        return { data, mediaType: 'image/jpeg' };
    if (data.length >= 12 && data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP')
        return { data, mediaType: 'image/webp' };
    if (data.length >= 6 && ['GIF87a', 'GIF89a'].includes(data.subarray(0, 6).toString()))
        return { data, mediaType: 'image/gif' };
    throw new Error('生成结果不是受支持的 PNG、JPEG、WebP 或 GIF 图片。');
}
