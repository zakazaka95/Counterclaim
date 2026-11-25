import {readdir, readFile, mkdir, writeFile, stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'app/package.json'));
const {build} = await import(pathToFileURL(require.resolve('vite')).href);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const frontend = spawnSync(npm, ['--prefix', 'app', 'run', 'build'], {
  cwd: ROOT, env: {...process.env, VITE_HOSTED_DEMO: 'true'}, stdio: 'inherit', shell: process.platform === 'win32',
});
if (frontend.status !== 0) throw new Error('Hosted frontend build failed');
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon'};
const assets = {};
async function collect(directory, prefix = '') {
  for (const row of await readdir(directory, {withFileTypes: true})) {
    const filename = path.join(directory, row.name), relative = prefix + '/' + row.name;
    if (row.isDirectory()) await collect(filename, relative);
    else if (row.isFile()) assets[relative] = {base64: (await readFile(filename)).toString('base64'), type: types[path.extname(row.name)] || 'application/octet-stream'};
  }
}
await collect(path.join(ROOT, 'app/dist'));
await build({configFile: false, root: ROOT, publicDir: false,
  plugins: [{name: 'counterclaim-embedded-assets', resolveId(id) {if (id === 'virtual:counterclaim-assets') return '\0counterclaim-assets';},
    load(id) {if (id === '\0counterclaim-assets') return 'export default ' + JSON.stringify(assets) + ';';}}],
  ssr: {noExternal: true},
  build: {ssr: 'hosting/worker.mjs', outDir: 'dist/server', emptyOutDir: true, minify: true,
    rollupOptions: {output: {format: 'es', entryFileNames: 'index.js', inlineDynamicImports: true}}},
});
const manifest = path.join(ROOT, '.openai/hosting.json');
try {
  await stat(manifest);
  const data = JSON.parse(await readFile(manifest, 'utf8'));
  if (data.static) throw new Error('Hosted Counterclaim requires a Worker, not a static deployment');
  if (data.d1 !== 'DB') throw new Error('Hosted Counterclaim requires its DB scheduler binding');
  await mkdir(path.join(ROOT, 'dist/.openai'), {recursive: true});
  await writeFile(path.join(ROOT, 'dist/.openai/hosting.json'), JSON.stringify(data, null, 2) + '\n');
} catch (error) {if (error.code !== 'ENOENT') throw error;}
console.log('Built the Counterclaim Worker with ' + Object.keys(assets).length + ' embedded assets.');
