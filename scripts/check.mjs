// Checks the built site: every local link, image (srcset too), font and inline url() resolves (anchors too), every page has
// its metadata, and no file is over Cloudflare Pages' 25 MiB.
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const LIMIT = 25 * 1024 * 1024;
async function walk(dir) {
  const entries = await readdir(dir);
  return (await Promise.all(entries.map(async name => {
    const p = path.join(dir, name);
    return (await stat(p)).isDirectory() ? walk(p) : p;
  }))).flat();
}

const files = await walk(root);
const errors = [];
let checked = 0;
for (const file of files) {
  const size = (await stat(file)).size;
  if (size > LIMIT) errors.push(`${file}: ${(size / 1048576).toFixed(1)} MiB, over Cloudflare Pages' 25 MiB (host it elsewhere and list its full https address)`);
}
for (const file of files.filter(f => /\.(html|css)$/.test(f))) {
  const content = await readFile(file, 'utf8');
  const refs = [
    ...(file.endsWith('.html') ? [...content.matchAll(/(?:href|src|srcset|poster)="([^"]+)"/g)].map(m => m[1]) : []),
    ...[...content.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)].map(m => m[1]),
  ];
  for (const ref of refs) {
    if (/^(?:https?:|data:|mailto:)/.test(ref)) continue;
    const [where, hash] = decodeURIComponent(ref).split('#');
    const name = where.split('?')[0];
    let target = name.startsWith('/') ? path.join(root, name) : path.resolve(path.dirname(file), name || path.basename(file));
    try {
      if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
      await stat(target);
      checked++;
      if (hash && target.endsWith('.html')) {
        const text = await readFile(target, 'utf8');
        if (!text.includes(`id="${hash}"`)) errors.push(`${file}: missing anchor ${ref}`);
      }
    } catch {
      errors.push(`${file}: missing file ${ref}`);
    }
  }
  if (file.endsWith('.html') && !(content.includes('<title>') && content.includes('name="description"') && content.includes('lang="en"')))
    errors.push(`${file}: missing metadata`);
}

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Checked ${checked} local references in ${files.length} files; every page has its metadata and every file fits.`);
