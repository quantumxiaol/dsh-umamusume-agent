export declare class ApiHttpError extends Error {
    readonly status: number;
    constructor(message: string, status: number);
}
export declare function apiUrl(baseUrl: string, path: string): string;
export declare function requestSignal(signal: AbortSignal): AbortSignal;
export declare function responseJson(response: Response): Promise<unknown>;
export declare function objectField(value: unknown, field: string): unknown;
export declare function firstChoiceMessage(payload: unknown): Record<string, unknown>;
