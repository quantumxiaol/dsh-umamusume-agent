import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

const result = await build({
  entryPoints: ['src/client.tsx'],
  outfile: 'dist/client.js',
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'cjs',
  external: ['react'],
  target: 'es2022',
  charset: 'utf8',
  minify: true,
  legalComments: 'inline',
  supported: { 'template-literal': false },
  banner: { js: 'window.__ModuleLoader__.load({ id: "dsh-umamusume-agent", factory: (require) => {\nconst module = { exports: {} };' },
  footer: { js: 'return module.exports;\n} });' },
});

await writeFile('dist/client.js', result.outputFiles[0].contents);
console.log('Built DSH web client.');
