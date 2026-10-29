import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, resolve, sep } from 'node:path';
import type { CharacterCard } from '../characters/types.js';
import type { StorySource } from './types.js';

interface CharacterMappingRow {
  id: string
  name_en: string
}

interface ManifestRow {
  chara_id: number
  relative_path: string
}

export class StoryCatalog {
  private constructor(
    private readonly root: string,
    private readonly characterIds: ReadonlyMap<string, string>,
    private readonly files: ReadonlyMap<string, string>,
  ) {}

  static load(directory: string, mappingPath: string): StoryCatalog {
    const root = resolve(directory);
    if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`Story directory does not exist: ${root}`);
    const mapping = JSON.parse(readFileSync(mappingPath, 'utf8')) as { characters?: CharacterMappingRow[] };
    if (!Array.isArray(mapping.characters)) throw new Error(`Invalid character mapping: ${mappingPath}`);
    const characterIds = new Map(mapping.characters.map(row => [row.name_en.trim().toLowerCase(), row.id]));
    const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8')) as ManifestRow[];
    if (!Array.isArray(manifest)) throw new Error(`Invalid story manifest: ${root}/manifest.json`);
    const files = new Map<string, string>();
    for (const row of manifest) {
      if (!Number.isInteger(row.chara_id) || typeof row.relative_path !== 'string') continue;
      if (basename(row.relative_path) !== row.relative_path || !row.relative_path.endsWith('.md')) continue;
      const path = resolve(root, row.relative_path);
      if (!path.startsWith(`${root}${sep}`) || !existsSync(path) || !statSync(path).isFile()) continue;
      files.set(String(row.chara_id), row.relative_path);
    }
    return new StoryCatalog(root, characterIds, files);
  }

  storyFor(character: CharacterCard): StorySource | undefined {
    const characterId = this.characterIds.get(character.nameEn.trim().toLowerCase());
    if (!characterId) return undefined;
    const relativePath = this.files.get(characterId);
    if (!relativePath) return undefined;
    return { path: resolve(this.root, relativePath), relativePath, characterId };
  }
}
