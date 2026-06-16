#!/usr/bin/env node
// Scaffold (or improvise) husky-based git hooks for a JS project.
// Invoked by the skillet installer and by the /husky-setup skill.
//
// Exit codes: 0 = done, 2 = skipped (not a JS git project), 1 = error.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BLOCK_START = '# >>> skillet (managed) — do not edit between markers >>>';
const BLOCK_END = '# <<< skillet (managed) <<<';

const FEATURE_DEPS = [
  'husky',
  'lint-staged',
  '@commitlint/cli',
  '@commitlint/config-conventional',
  'secretlint',
  '@secretlint/secretlint-rule-preset-recommend',
];

const CODE_GLOB = '*.{js,jsx,ts,tsx,mjs,cjs,mts,cts,vue,svelte,astro}';

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', ...opts });
}
function shQuiet(cmd, args) {
  try {
    return sh(cmd, args).trim();
  } catch {
    return '';
  }
}
const exists = (p) => fs.existsSync(p);

function gitRoot(cwd) {
  try {
    return sh('git', ['rev-parse', '--show-toplevel'], { cwd }).trim();
  } catch {
    return null;
  }
}

function readPkg(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

function detectPm(root) {
  if (exists(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (exists(path.join(root, 'yarn.lock'))) return 'yarn';
  if (exists(path.join(root, 'bun.lockb')) || exists(path.join(root, 'bun.lock'))) return 'bun';
  return 'npm';
}

function hasFile(root, names) {
  return names.some((n) => exists(path.join(root, n)));
}

function depList(pkg) {
  return { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
}

function detectTooling(root, pkg) {
  const deps = depList(pkg);
  const scripts = pkg.scripts || {};
  const biome = hasFile(root, ['biome.json', 'biome.jsonc']) || Boolean(deps['@biomejs/biome']);
  const eslint =
    hasFile(root, ['.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yaml', '.eslintrc.yml', 'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts']) ||
    Boolean(deps.eslint);
  const prettier =
    hasFile(root, ['.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.cjs', '.prettierrc.yaml', '.prettierrc.yml', 'prettier.config.js', 'prettier.config.cjs', 'prettier.config.mjs']) ||
    Boolean(deps.prettier);
  const ts = exists(path.join(root, 'tsconfig.json')) && Boolean(deps.typescript);
  return {
    biome,
    eslint,
    prettier,
    typecheckScript: Boolean(scripts.typecheck),
    tsc: ts,
    lintScript: Boolean(scripts.lint),
    formatScript: Boolean(scripts.format),
  };
}

function detectWorkspaces(root, pkg) {
  return exists(path.join(root, 'pnpm-workspace.yaml')) || Boolean(pkg.workspaces);
}

function installArgs(pm, pkgs) {
  if (pm === 'pnpm' || pm === 'yarn') return ['add', '-D', ...pkgs];
  if (pm === 'bun') return ['add', '-d', ...pkgs];
  return ['install', '-D', ...pkgs];
}

// Replace any existing skillet-managed block in `content`, then append a fresh
// one. Custom lines outside the markers are preserved.
function withManagedBlock(content, body) {
  const stripped = content.replace(
    new RegExp(`${escapeRe(BLOCK_START)}[\\s\\S]*?${escapeRe(BLOCK_END)}\\n?`, 'g'),
    '',
  );
  const base = stripped.trim();
  const block = `${BLOCK_START}\n${body}\n${BLOCK_END}\n`;
  return base ? `${base}\n\n${block}` : block;
}
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function writeHookFile(huskyDir, name, body) {
  const file = path.join(huskyDir, name);
  const cur = exists(file) ? fs.readFileSync(file, 'utf8') : '';
  fs.writeFileSync(file, withManagedBlock(cur, body));
  fs.chmodSync(file, 0o755);
}

function copyHookScripts(root) {
  const dst = path.join(root, '.skillet', 'hooks');
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(path.join(HERE, 'hooks'))) {
    fs.copyFileSync(path.join(HERE, 'hooks', f), path.join(dst, f));
  }
}

function buildLintStaged(tool) {
  const config = { '*': ['secretlint'] };
  const codeCmds = [];
  if (tool.biome) {
    codeCmds.push('biome check --write --no-errors-on-unmatched');
  } else {
    if (tool.eslint) codeCmds.push('eslint --fix');
    if (tool.prettier) codeCmds.push('prettier --write');
  }
  if (codeCmds.length) config[CODE_GLOB] = codeCmds;
  return config;
}

function ensurePrepareScript(root) {
  const file = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  pkg.scripts ||= {};
  if (pkg.scripts.prepare !== 'husky') {
    // Preserve any existing prepare by chaining husky onto it.
    pkg.scripts.prepare = pkg.scripts.prepare
      ? `${pkg.scripts.prepare} && husky`
      : 'husky';
    fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
    return true;
  }
  return false;
}

function main() {
  const cwd = process.argv[2] || process.cwd();
  const root = gitRoot(cwd);
  if (!root) {
    console.log('SKIP: not inside a git repository — husky needs a git repo.');
    process.exit(2);
  }
  const pkg = readPkg(root);
  if (!pkg) {
    console.log(`SKIP: no package.json at git root (${root}) — not a JS project.`);
    process.exit(2);
  }

  const pm = detectPm(root);
  const tool = detectTooling(root, pkg);
  const workspaces = detectWorkspaces(root, pkg);
  const notes = [];

  // 1. Install the feature's own devDeps (only those missing — idempotent).
  const have = depList(pkg);
  const missing = FEATURE_DEPS.filter((d) => !have[d]);
  if (missing.length) {
    console.log(`Installing (${pm}): ${missing.join(', ')}`);
    sh(pm, installArgs(pm, missing), { cwd: root, stdio: 'inherit' });
  } else {
    notes.push('feature deps already present — skipped install');
  }

  // 2. Initialize husky (idempotent) + ensure the prepare script.
  fs.mkdirSync(path.join(root, '.husky'), { recursive: true });
  shQuiet('npx', ['husky']); // sets up .husky/_/ and git hooksPath
  if (ensurePrepareScript(root)) notes.push('added "prepare": "husky" to package.json');

  // 3. Drop the check scripts.
  copyHookScripts(root);

  // 4. Wire the hooks (managed blocks; custom lines preserved).
  const huskyDir = path.join(root, '.husky');
  writeHookFile(huskyDir, 'pre-commit', 'node .skillet/hooks/pre-commit.mjs');
  writeHookFile(huskyDir, 'commit-msg', 'node .skillet/hooks/commit-msg.mjs "$1"');
  writeHookFile(huskyDir, 'pre-push', 'node .skillet/hooks/pre-push.mjs');

  // 5. Configs — never clobber an existing one (improvise).
  const writeIfAbsent = (names, src, dstName, label) => {
    if (hasFile(root, names)) {
      notes.push(`kept existing ${label} config`);
      return;
    }
    fs.copyFileSync(src, path.join(root, dstName));
  };
  writeIfAbsent(
    ['commitlint.config.cjs', 'commitlint.config.js', 'commitlint.config.mjs', '.commitlintrc', '.commitlintrc.json', '.commitlintrc.cjs', '.commitlintrc.js'],
    path.join(HERE, 'configs', 'commitlint.config.cjs'),
    'commitlint.config.cjs',
    'commitlint',
  );
  writeIfAbsent(
    ['.secretlintrc.json', '.secretlintrc', '.secretlintrc.yaml', '.secretlintrc.yml', '.secretlintrc.js'],
    path.join(HERE, 'configs', 'secretlintrc.json'),
    '.secretlintrc.json',
    'secretlint',
  );

  // lint-staged config (generated from detected tools).
  const lintStagedNames = ['.lintstagedrc', '.lintstagedrc.json', '.lintstagedrc.js', '.lintstagedrc.cjs', '.lintstagedrc.mjs', '.lintstagedrc.yaml', '.lintstagedrc.yml', 'lint-staged.config.js', 'lint-staged.config.mjs', 'lint-staged.config.cjs'];
  if (hasFile(root, lintStagedNames) || pkg['lint-staged']) {
    notes.push('kept existing lint-staged config');
  } else {
    const cfg = buildLintStaged(tool);
    fs.writeFileSync(path.join(root, '.lintstagedrc.json'), `${JSON.stringify(cfg, null, 2)}\n`);
  }

  // 6. Report.
  const lintFmt = tool.biome
    ? 'biome (lint+format)'
    : [tool.eslint && 'eslint', tool.prettier && 'prettier'].filter(Boolean).join(' + ') || 'none detected — pre-commit runs secret scan only';
  const tc = tool.typecheckScript ? 'npm script: typecheck' : tool.tsc ? 'tsc --noEmit' : 'none (no tsconfig/typescript) — skipped';

  console.log('\n✔ husky hooks scaffolded at', root);
  console.log('  package manager :', pm + (workspaces ? ' (workspaces detected)' : ''));
  console.log('  pre-commit      : lint-staged →', lintFmt + ', + secretlint (staged)');
  console.log('  commit-msg      : commitlint (Conventional Commits)');
  console.log('  pre-push        : ' + tc + ', + size gates (≤1000 code / ≤2000 per test file)');
  if (notes.length) console.log('  notes           : ' + notes.join('; '));
  console.log('\n  Files are left UNSTAGED — review the diff, then commit.');
  console.log('  Secret scanning is bypassable with `git commit --no-verify`; for a hard guarantee add server-side scanning in CI.\n');
  process.exit(0);
}

main();
