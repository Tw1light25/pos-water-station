/**
 * Copies the browser-safe shared modules into site/assets/shared/ so the
 * customer site (served by Netlify) imports the exact same code the admin and
 * the API use - no drift, no duplicated logic.
 *
 * Runs automatically before `site:dev` and on every Netlify deploy.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FROM = path.join(ROOT, 'shared');
const TO = path.join(ROOT, 'site', 'assets', 'shared');

const FILES = ['store-status.js', 'ids.js'];

const BANNER = [
  '/* GENERATED FILE - do not edit.',
  ' * Copied from /shared/ by scripts/prepare-site.js so the browser, the admin',
  ' * and the Netlify functions all run identical code.',
  ' * Edit the original in /shared/ instead.',
  ' */',
  '',
  '',
].join('\n');

fs.mkdirSync(TO, { recursive: true });

for (const file of FILES) {
  const source = path.join(FROM, file);
  if (!fs.existsSync(source)) {
    console.error(`prepare-site: missing shared module ${file}`);
    process.exit(1);
  }
  fs.writeFileSync(path.join(TO, file), BANNER + fs.readFileSync(source, 'utf8'));
}

console.log(`prepare-site: copied ${FILES.length} shared module(s) -> site/assets/shared/`);
