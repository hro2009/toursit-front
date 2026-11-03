import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const publicEntries = ['admin', 'css', 'icons', 'js', 'lang', 'index.html', 'config.js', 'script.js', 'style.css'];

fs.mkdirSync(output, { recursive: true });
for (const entry of publicEntries) {
  fs.cpSync(path.join(root, entry), path.join(output, entry), { recursive: true });
}

const commit = process.env.RENDER_GIT_COMMIT || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
fs.writeFileSync(path.join(output, 'version.json'), `${JSON.stringify({ commit })}\n`);
