import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, resolve, sep } from 'node:path';
export class StoryCatalog {
    root;
    characterIds;
    files;
    constructor(root, characterIds, files) {
        this.root = root;
        this.characterIds = characterIds;
        this.files = files;
    }
    static load(directory, mappingPath) {
        const root = resolve(directory);
        if (!existsSync(root) || !statSync(root).isDirectory())
            throw new Error(`Story directory does not exist: ${root}`);
        const mapping = JSON.parse(readFileSync(mappingPath, 'utf8'));
        if (!Array.isArray(mapping.characters))
            throw new Error(`Invalid character mapping: ${mappingPath}`);
        const characterIds = new Map(mapping.characters.map(row => [row.name_en.trim().toLowerCase(), row.id]));
        const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
        if (!Array.isArray(manifest))
            throw new Error(`Invalid story manifest: ${root}/manifest.json`);
        const files = new Map();
        for (const row of manifest) {
            if (!Number.isInteger(row.chara_id) || typeof row.relative_path !== 'string')
                continue;
            if (basename(row.relative_path) !== row.relative_path || !row.relative_path.endsWith('.md'))
                continue;
            const path = resolve(root, row.relative_path);
            if (!path.startsWith(`${root}${sep}`) || !existsSync(path) || !statSync(path).isFile())
                continue;
            files.set(String(row.chara_id), row.relative_path);
        }
        return new StoryCatalog(root, characterIds, files);
    }
    storyFor(character) {
        const characterId = this.characterIds.get(character.nameEn.trim().toLowerCase());
        if (!characterId)
            return undefined;
        const relativePath = this.files.get(characterId);
        if (!relativePath)
            return undefined;
        return { path: resolve(this.root, relativePath), relativePath, characterId };
    }
}
