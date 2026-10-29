import { REQUEST_TIMEOUT_MS } from '../config.js';
export class ApiHttpError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = 'ApiHttpError';
    }
}
export function apiUrl(baseUrl, path) {
    const url = new URL(`${baseUrl.replace(/\/+$/, '')}${path}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:')
        throw new Error('API 地址仅支持 HTTP/HTTPS。');
    return url.toString();
}
export function requestSignal(signal) {
    return AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
}
export async function responseJson(response) {
    const text = await response.text();
    let payload;
    try {
        payload = text ? JSON.parse(text) : {};
    }
    catch {
        throw new ApiHttpError(`API 返回了非 JSON 响应（HTTP ${response.status}）：${text.slice(0, 300)}`, response.status);
    }
    if (!response.ok) {
        const guidance = response.status === 429 ? '；请勿立即重试，请等待限流恢复后再试' : '';
        throw new ApiHttpError(`API 请求失败（HTTP ${response.status}）：${upstreamMessage(payload)}${guidance}`, response.status);
    }
    return payload;
}
function upstreamMessage(payload) {
    if (typeof payload !== 'object' || payload === null)
        return '未知错误';
    const value = payload;
    if (typeof value.error === 'string')
        return value.error.slice(0, 1000);
    if (typeof value.error === 'object' && value.error !== null) {
        const message = value.error.message;
        if (typeof message === 'string')
            return message.slice(0, 1000);
    }
    return typeof value.message === 'string' ? value.message.slice(0, 1000) : '未知错误';
}
export function objectField(value, field) {
    if (typeof value !== 'object' || value === null)
        throw new Error('API 响应格式不正确。');
    return value[field];
}
export function firstChoiceMessage(payload) {
    const choices = objectField(payload, 'choices');
    if (!Array.isArray(choices) || !choices.length)
        throw new Error('API 响应缺少 choices。');
    const message = objectField(choices[0], 'message');
    if (typeof message !== 'object' || message === null)
        throw new Error('API 响应缺少 message。');
    return message;
}
