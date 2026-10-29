export interface CharacterAsset {
    path: string;
    name: string;
}
export interface CharacterCard {
    id: string;
    presetId: string;
    name: string;
    nameEn: string;
    prompt: string;
    portrait?: CharacterAsset;
    referenceAudio?: CharacterAsset;
    referenceText?: string;
}
export interface CapabilityAvailability {
    image: boolean;
    tts: boolean;
    asr: boolean;
    search: boolean;
    story: boolean;
}
