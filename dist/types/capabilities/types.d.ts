export interface GeneratedImage {
    data: Buffer;
    mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
}
export interface ImageGenerationInput {
    prompt: string;
    size: '1024x1024' | '1024x1536' | '1536x1024';
    quality: 'auto' | 'low' | 'medium' | 'high';
    reference?: {
        data: Buffer;
        name: string;
    };
    referenceDescription?: string;
    signal: AbortSignal;
}
export interface SpeechSynthesisInput {
    text: string;
    style?: string;
    signal: AbortSignal;
}
export interface SpeechRecognitionInput {
    data: Buffer;
    format: 'mp3' | 'wav';
    language: 'auto' | 'zh' | 'en';
    signal: AbortSignal;
}
