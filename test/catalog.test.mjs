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

const SETUP_MD = path.join(ROOT, 'skills', 'skillet-setup', 'SKILL.md');

// The agent-run /skillet-setup path has its own hardcoded install list (the
// "For each of `a`, `b`, …:" sentence). It must enumerate exactly the same
// skills as the npx CLI, or one install path silently ships a different set.
function installLoopSkills() {
  const md = fs.readFileSync(SETUP_MD, 'utf8');
  const line = md.split('\n').find((l) => l.startsWith('For each of'));
  assert.ok(line, '"For each of" install list not found in skillet-setup/SKILL.md');
  return [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
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

test('skillet-setup install list matches the SKILLS catalog (no path drift)', () => {
  const catalog = new Set(catalogValues());
  const loop = new Set(installLoopSkills());
  for (const v of catalog) {
    assert.ok(loop.has(v), `'${v}' is in SKILLS but missing from skillet-setup/SKILL.md install list`);
  }
  for (const v of loop) {
    assert.ok(catalog.has(v), `'${v}' is in skillet-setup/SKILL.md install list but not in SKILLS`);
  }
});

test('skillet-setup verify "# expect N" matches catalog size', () => {
  const md = fs.readFileSync(SETUP_MD, 'utf8');
  const m = md.match(/# expect (\d+)/);
  assert.ok(m, '"# expect N" not found in skillet-setup/SKILL.md verify block');
  assert.equal(Number(m[1]), catalogValues().length, 'verify count is out of sync with the SKILLS catalog');
});
