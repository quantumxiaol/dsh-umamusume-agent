import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('story catalog and bounded rg/grep retrieval work without external assets', async () => {
  const { StoryCatalog } = await import('../dist/story/catalog.js');
  const { searchStory } = await import('../dist/story/search.js');
  const root = await mkdtemp(join(tmpdir(), 'uma-story-test-'));
  const previousPath = process.env.PATH;
  try {
    const storyDirectory = join(root, 'results', 'character_story');
    await mkdir(storyDirectory, { recursive: true });
    const mappingPath = join(root, 'umamusume_characters.json');
    await writeFile(mappingPath, JSON.stringify({ characters: [{ id: '1001', name_en: 'Test Character' }] }));
    await writeFile(join(storyDirectory, 'manifest.json'), JSON.stringify([{ chara_id: 1001, relative_path: '1001-テスト.md' }]));
    await writeFile(join(storyDirectory, '1001-テスト.md'), '# テスト\n\n- **キャラ**: カイチョーと走る\n  - <sub>block=1</sub>\n- **モノローグ**: これは合成テストです。\n');
    const catalog = StoryCatalog.load(storyDirectory, mappingPath);
    const source = catalog.storyFor({ nameEn: 'Test Character' });
    assert.ok(source);
    const common = { signal: AbortSignal.timeout(5000) };
    const viaRg = await searchStory(source, 'カイチョー', 1, common.signal);
    assert.equal(viaRg.matches.length, 1);
    assert.ok(viaRg.matches[0].line > 0);
    assert.doesNotMatch(viaRg.matches[0].excerpt, /<sub>/);
    process.env.PATH = '/usr/bin:/bin';
    const viaGrep = await searchStory(source, 'カイチョー', 1, common.signal);
    assert.deepEqual(viaGrep.matches, viaRg.matches);
    const empty = await searchStory(source, '存在しない語', 1, common.signal);
    assert.deepEqual(empty.matches, []);
  } finally {
    process.env.PATH = previousPath;
    await rm(root, { recursive: true, force: true });
  }
});
