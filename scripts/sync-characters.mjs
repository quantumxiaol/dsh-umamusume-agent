import { copyFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = resolve(process.argv[2] ?? '');
if (!process.argv[2]) {
  console.error('Usage: npm run characters:sync -- /absolute/path/to/umamusume-agent/characters');
  process.exit(1);
}
const destination = fileURLToPath(new URL('../characters/', import.meta.url));
const mediaPattern = /^(?:reference(?:_[a-z]+)?\.(?:mp3|wav|txt)|(?:ZF|JSF)_.+\.png)$/i;

async function assertNotLfsPointer(path) {
  const data = await readFile(path);
  if (data.subarray(0, 200).toString('utf8').startsWith('version https://git-lfs.github.com/spec/')) {
    throw new Error(`${path} is a Git LFS pointer. Run git lfs pull in the source repository first.`);
  }
}

const entries = await readdir(source, { withFileTypes: true });
let count = 0;
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const sourceDirectory = join(source, entry.name);
  const configPath = join(sourceDirectory, 'config.json');
  const promptPath = join(sourceDirectory, 'prompt.md');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const prompt = await readFile(promptPath, 'utf8');
  if (typeof config.name_zh !== 'string' || typeof config.name_en !== 'string' || !prompt.trim()) {
    throw new Error(`Invalid character card: ${sourceDirectory}`);
  }
  const targetDirectory = join(destination, entry.name);
  await mkdir(targetDirectory, { recursive: true });
  await Promise.all([copyFile(configPath, join(targetDirectory, 'config.json')), copyFile(promptPath, join(targetDirectory, 'prompt.md'))]);
  const files = await readdir(sourceDirectory, { withFileTypes: true });
  for (const file of files) {
    if (!file.isFile() || !mediaPattern.test(file.name)) continue;
    const from = join(sourceDirectory, file.name);
    await assertNotLfsPointer(from);
    await copyFile(from, join(targetDirectory, basename(file.name)));
  }
  count += 1;
}
console.log(`Synchronized ${count} character cards to ${destination}`);
