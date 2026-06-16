// pre-push: whole-project typecheck, then branch size gates.
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { hasScript, runScript, bin, run } from './_util.mjs';

// 1. Typecheck (prefer the project's own script; else tsc if TS is set up).
if (hasScript('typecheck')) runScript('typecheck');
else if (existsSync('tsconfig.json')) bin(['tsc', '--noEmit']);

// 2. Size gates: PR-diff (≤1000 code lines) + per-test-file (≤2000 lines).
run('node', [fileURLToPath(new URL('./size-check.mjs', import.meta.url))]);
