// Shared helpers for skillet git hooks. Copied verbatim into <repo>/.skillet/hooks/.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const WIN = process.platform === 'win32';

// Run a command inheriting stdio. On failure, exit the hook with the child's
// status (blocks the git operation) unless allowFail is set.
export function run(cmd, args, { allowFail = false } = {}) {
  try {
    execFileSync(cmd, args, { stdio: 'inherit', shell: WIN });
    return true;
  } catch (e) {
    if (allowFail) return false;
    process.exit(typeof e.status === 'number' ? e.status : 1);
  }
}

export function pkg() {
  try {
    return JSON.parse(readFileSync('package.json', 'utf8'));
  } catch {
    return {};
  }
}

export function hasScript(name) {
  return Boolean(pkg().scripts?.[name]);
}

export function detectPm() {
  if (existsSync('pnpm-lock.yaml')) return 'pnpm';
  if (existsSync('yarn.lock')) return 'yarn';
  if (existsSync('bun.lockb') || existsSync('bun.lock')) return 'bun';
  return 'npm';
}

export function runScript(name) {
  const pm = detectPm();
  return run(pm, pm === 'npm' ? ['run', name] : [name]);
}

// Run a locally-installed binary. --no-install on npm avoids surprise network
// fetches: deps are devDependencies, so `<pm> install` must have been run.
export function bin(args, opts) {
  const pm = detectPm();
  if (pm === 'bun') return run('bunx', args, opts);
  return run('npx', ['--no-install', ...args], opts);
}
