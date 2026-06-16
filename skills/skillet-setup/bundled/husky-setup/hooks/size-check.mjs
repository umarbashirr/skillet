// Skillet size-gate logic. Pure functions are exported and unit-tested;
// main() (git/fs IO) runs only when this file is executed directly.

const DEFAULT_MAX_PROD = 1000;
const DEFAULT_MAX_TEST_FILE = 2000;

const LOCKFILES = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
]);

// Extensions that are data/docs/assets, never counted as code.
const NONCODE_EXT = new Set([
  'md', 'mdx', 'markdown',
  'json', 'yaml', 'yml', 'toml', 'xml', 'csv',
  'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'avif',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'lock', 'lockb', 'snap', 'map', 'pdf',
]);

// Path segments whose contents are generated/vendored — excluded wholesale.
const GENERATED_DIRS = new Set([
  'dist', 'build', 'out', 'coverage', '.next', '.nuxt', '.svelte-kit',
  'node_modules', 'vendor', '__snapshots__',
]);

const TEST_DIRS = new Set(['__tests__', '__test__', 'test', 'tests', 'e2e', 'cypress']);
const TEST_SUFFIX = /\.(test|spec|e2e|cy)\.[mc]?[jt]sx?$/;

function segments(file) {
  return String(file).replace(/\\/g, '/').split('/').filter(Boolean);
}

function basename(file) {
  const segs = segments(file);
  return segs[segs.length - 1] ?? '';
}

function ext(file) {
  const base = basename(file);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

export function isNonCode(file) {
  const base = basename(file);
  if (LOCKFILES.has(base)) return true;
  if (base.startsWith('.env')) return true;
  if (segments(file).some((s) => GENERATED_DIRS.has(s))) return true;
  if (NONCODE_EXT.has(ext(file))) return true;
  return false;
}

export function isTestFile(file) {
  const base = basename(file);
  if (TEST_SUFFIX.test(base)) return true;
  if (segments(file).slice(0, -1).some((s) => TEST_DIRS.has(s))) return true;
  return false;
}

// files: [{ path, added }] — sum added lines of code, excluding tests/non-code.
export function sumProdAdded(files) {
  return files
    .filter((f) => !isNonCode(f.path) && !isTestFile(f.path))
    .reduce((sum, f) => sum + (f.added ?? 0), 0);
}

// files: [{ path, total }] — test files whose total length exceeds the limit.
export function testFileViolations(files, limit) {
  return files
    .filter((f) => isTestFile(f.path) && (f.total ?? 0) > limit)
    .map((f) => ({ path: f.path, total: f.total }));
}

export function evaluate(files, opts = {}) {
  const maxProd = opts.maxProd ?? DEFAULT_MAX_PROD;
  const maxTestFile = opts.maxTestFile ?? DEFAULT_MAX_TEST_FILE;
  const prodAdded = sumProdAdded(files);
  const prodViolation = prodAdded > maxProd;
  const testViolations = testFileViolations(files, maxTestFile);
  return {
    ok: !prodViolation && testViolations.length === 0,
    prodAdded,
    prodLimit: maxProd,
    prodViolation,
    testViolations,
    testLimit: maxTestFile,
  };
}

// --- IO layer (runs only when executed directly) ---

async function main() {
  const { execFileSync } = await import('node:child_process');
  const fs = await import('node:fs');

  const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const gitQuiet = (args) => {
    try {
      return git(args);
    } catch {
      return '';
    }
  };

  // Inside a git repo?
  if (!gitQuiet(['rev-parse', '--is-inside-work-tree'])) {
    console.log('skillet size-check: not a git repo — skipping.');
    return;
  }

  const maxProd = Number(process.env.SKILLET_MAX_PROD || DEFAULT_MAX_PROD);
  const maxTestFile = Number(process.env.SKILLET_MAX_TEST_FILE || DEFAULT_MAX_TEST_FILE);

  // Resolve the base ref to diff against.
  const base = resolveBase(gitQuiet);
  if (!base) {
    console.log('skillet size-check: no base branch found (origin/HEAD, main, master, develop) — skipping.');
    return;
  }

  // Changed files since divergence from base (three-dot = vs merge-base).
  const numstat = gitQuiet(['diff', '--numstat', `${base}...HEAD`]);
  if (!numstat) return; // nothing ahead of base

  const files = numstat
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [added, , ...rest] = line.split('\t');
      const path = rest.join('\t');
      return { path, added: added === '-' ? 0 : Number(added) };
    });

  // For test files, attach total length (committed HEAD version).
  for (const f of files) {
    if (isTestFile(f.path)) f.total = countLines(gitQuiet, fs, f.path);
  }

  const report = evaluate(files, { maxProd, maxTestFile });
  if (report.ok) {
    console.log(
      `skillet size-check ✔  prod +${report.prodAdded}/${report.prodLimit} lines vs ${base}; ` +
        `test files ≤ ${report.testLimit}`,
    );
    return;
  }

  console.error('\nskillet size-check ✘ — push blocked\n');
  if (report.prodViolation) {
    console.error(
      `  • Production diff is ${report.prodAdded} added code lines vs ${base} (limit ${report.prodLimit}).`,
    );
    console.error('    Split this into smaller PRs (tests and non-code files are excluded from this count).');
  }
  for (const v of report.testViolations) {
    console.error(`  • Test file ${v.path} is ${v.total} lines (limit ${report.testLimit}). Split it up.`);
  }
  console.error('\n  Override for a single push with: git push --no-verify\n');
  process.exitCode = 1;
}

function resolveBase(gitQuiet) {
  const head = gitQuiet(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  const candidates = [
    process.env.SKILLET_BASE_BRANCH, // explicit override
    head, // e.g. origin/main
    'origin/main',
    'origin/master',
    'origin/develop',
    'main',
    'master',
    'develop',
  ].filter(Boolean);
  for (const ref of candidates) {
    if (gitQuiet(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])) return ref;
  }
  return null;
}

function countLines(gitQuiet, fs, path) {
  // Prefer the committed version; fall back to the working tree.
  let content = gitQuiet(['show', `HEAD:${path}`]);
  if (!content) {
    try {
      content = fs.readFileSync(path, 'utf8');
    } catch {
      return 0;
    }
  }
  if (!content) return 0;
  const lines = content.split(/\r?\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.length;
}

// Run main() only when invoked directly, never when imported by tests.
{
  const { fileURLToPath } = await import('node:url');
  const path = await import('node:path');
  const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  if (invoked) await main();
}
