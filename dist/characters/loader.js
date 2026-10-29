import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
function asset(directory, name) {
    return name ? { path: join(directory, name), name } : undefined;
}
function presetSlug(id) {
    return id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
export function loadCharacters(directory) {
    const root = resolve(directory);
    const cards = [];
    const presetIds = new Set();
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory())
            continue;
        if (!/^[a-z0-9][a-z0-9._-]*$/i.test(entry.name))
            throw new Error(`Invalid character id: ${entry.name}`);
        const characterDirectory = join(root, entry.name);
        const metadata = JSON.parse(readFileSync(join(characterDirectory, 'config.json'), 'utf8'));
        if (typeof metadata.name_zh !== 'string' || !metadata.name_zh.trim())
            throw new Error(`Missing name_zh: ${entry.name}`);
        if (typeof metadata.name_en !== 'string' || !metadata.name_en.trim())
            throw new Error(`Missing name_en: ${entry.name}`);
        const prompt = readFileSync(join(characterDirectory, 'prompt.md'), 'utf8').trim();
        if (!prompt)
            throw new Error(`Empty prompt: ${entry.name}`);
        const slug = presetSlug(entry.name);
        const presetId = `umamusume-${slug}`;
        if (!slug || presetIds.has(presetId))
            throw new Error(`Duplicate preset id: ${presetId}`);
        presetIds.add(presetId);
        const files = readdirSync(characterDirectory).filter(file => existsSync(join(characterDirectory, file)));
        const portrait = files.find(file => /^ZF_.+\.png$/i.test(file)) ?? files.find(file => /^JSF_.+\.png$/i.test(file));
        const audio = files.find(file => /^reference\.(?:mp3|wav)$/i.test(file));
        const referenceTextPath = files.find(file => file === 'reference_jp.txt') ?? files.find(file => file === 'reference_zh.txt');
        cards.push({
            id: entry.name,
            presetId,
            name: metadata.name_zh,
            nameEn: metadata.name_en,
            prompt,
            portrait: asset(characterDirectory, portrait),
            referenceAudio: asset(characterDirectory, audio),
            referenceText: referenceTextPath ? readFileSync(join(characterDirectory, referenceTextPath), 'utf8').trim() : undefined,
        });
    }
    if (!cards.length)
        throw new Error(`No character cards found in ${root}`);
    return cards.sort((a, b) => a.nameEn.localeCompare(b.nameEn, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id));
}
