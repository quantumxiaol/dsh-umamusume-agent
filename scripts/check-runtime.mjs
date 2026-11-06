import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Run the same offline suite with another installed SDK without replacing the
// developer's dependencies or touching any Desktop profile/session files.
if (!process.argv[2]) throw new Error('Usage: npm run check:runtime -- /absolute/path/to/runtime/node_modules');
const modules = resolve(process.argv[2]);
const sdk = JSON.parse(await readFile(join(modules, '@deepseek-ai/dsh-tools/package.json'), 'utf8'));
const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), 'umamusume-runtime-'));
try {
  for (const entry of ['package.json', 'dist', 'tests']) await cp(join(root, entry), join(scratch, entry), { recursive: true });
  const localModules = join(scratch, 'node_modules');
  await mkdir(localModules);
  for (const entry of await readdir(modules)) await symlink(join(modules, entry), join(localModules, entry));
  // Desktop ships React inside its UI bundles, not its server SDK. SSR tests
  // may use this repository's test-only React without substituting host APIs.
  for (const entry of ['react', 'react-dom']) {
    if (await access(join(localModules, entry)).then(() => false, () => true)) await symlink(join(root, 'node_modules', entry), join(localModules, entry), 'dir');
  }
  await symlink(join(root, 'characters'), join(scratch, 'characters'), 'dir');
  console.log(`Offline compatibility checks: Harness ${sdk.version}`);
  const tests = (await readdir(join(scratch, 'tests'))).filter(name => name.endsWith('.test.mjs')).map(name => join('tests', name));
  execFileSync(process.execPath, ['--test', ...tests], {
    cwd: scratch, stdio: 'inherit', env: { ...process.env, UMA_LIVE_API_TEST: '0' },
  });
} finally {
  await rm(scratch, { recursive: true, force: true });
}
