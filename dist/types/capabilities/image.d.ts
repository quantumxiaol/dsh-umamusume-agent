import type UmamusumeService from '../index.js';
import type { GeneratedImage, ImageGenerationInput } from './types.js';
export declare function generateImage(service: UmamusumeService, input: ImageGenerationInput): Promise<GeneratedImage>;
