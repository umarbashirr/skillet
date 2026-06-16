// Guard: the installer menu (SKILLS in bin/skillet.js) and the bundled skill
// directories must stay in lockstep. A skill in the menu with no bundled dir
// fails to install; a bundled dir absent from the menu ships dead weight.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BUNDLED = path.join(ROOT, 'skills', 'skillet-setup', 'bundled');

// Parse SKILLS values without importing bin/skillet.js (importing would run the CLI).
function catalogValues() {
  const src = fs.readFileSync(path.join(ROOT, 'bin', 'skillet.js'), 'utf8');
  const start = src.indexOf('const SKILLS = [');
  assert.notEqual(start, -1, 'SKILLS array not found in bin/skillet.js');
  const block = src.slice(start, src.indexOf('];', start));
  return [...block.matchAll(/value:\s*'([^']+)'/g)].map((m) => m[1]);
}

function bundledDirs() {
  return fs
    .readdirSync(BUNDLED, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

test('every SKILLS catalog entry has a bundled skill directory', () => {
  const dirs = new Set(bundledDirs());
  for (const v of catalogValues()) {
    assert.ok(dirs.has(v), `SKILLS entry '${v}' has no bundled/${v} dir`);
  }
});

test('every bundled skill directory is listed in the SKILLS catalog', () => {
  const values = new Set(catalogValues());
  for (const d of bundledDirs()) {
    assert.ok(values.has(d), `bundled/${d} is missing from the SKILLS catalog`);
  }
});

test('every bundled skill ships a SKILL.md.template', () => {
  for (const d of bundledDirs()) {
    assert.ok(
      fs.existsSync(path.join(BUNDLED, d, 'SKILL.md.template')),
      `bundled/${d} is missing SKILL.md.template`,
    );
  }
});
