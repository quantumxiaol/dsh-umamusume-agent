import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function digestBuild() {
  if (!existsSync('dist')) return '';
  const hash = createHash('sha256');
  const files = readdirSync('dist', { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && !entry.name.endsWith('.map'))
    .map(entry => join(entry.parentPath, entry.name)).sort();
  for (const file of files) hash.update(file).update(readFileSync(file));
  return hash.digest('hex');
}

const before = digestBuild();
execFileSync(process.execPath, [join('node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.json'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/build-client.mjs'], { stdio: 'inherit' });
if (before !== digestBuild()) {
  console.error('dist changed during build. Run npm run build and include the updated output.');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
readFileSync(manifest.main);
readFileSync(manifest.exports['./preset']);
console.log('Build output is current and both plugin entries exist.');
