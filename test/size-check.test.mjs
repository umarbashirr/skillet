import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isNonCode,
  isTestFile,
  sumProdAdded,
  testFileViolations,
  evaluate,
} from '../skills/skillet-setup/bundled/husky-setup/hooks/size-check.mjs';

test('isNonCode flags lockfiles', () => {
  assert.equal(isNonCode('package-lock.json'), true);
  assert.equal(isNonCode('pnpm-lock.yaml'), true);
  assert.equal(isNonCode('yarn.lock'), true);
  assert.equal(isNonCode('bun.lockb'), true);
});

test('isNonCode flags docs, config, assets, env, generated', () => {
  assert.equal(isNonCode('README.md'), true);
  assert.equal(isNonCode('docs/guide.md'), true);
  assert.equal(isNonCode('app.config.json'), true);
  assert.equal(isNonCode('tsconfig.json'), true);
  assert.equal(isNonCode('ci.yaml'), true);
  assert.equal(isNonCode('ci.yml'), true);
  assert.equal(isNonCode('logo.svg'), true);
  assert.equal(isNonCode('assets/image.png'), true);
  assert.equal(isNonCode('.env.local'), true);
  assert.equal(isNonCode('src/__snapshots__/x.snap'), true);
  assert.equal(isNonCode('dist/bundle.js'), true);
  assert.equal(isNonCode('build/out.js'), true);
});

test('isNonCode treats source files as code', () => {
  assert.equal(isNonCode('src/index.ts'), false);
  assert.equal(isNonCode('src/app.tsx'), false);
  assert.equal(isNonCode('lib/util.js'), false);
  assert.equal(isNonCode('components/Btn.vue'), false);
  assert.equal(isNonCode('page.svelte'), false);
});

test('isTestFile recognizes suffix patterns', () => {
  assert.equal(isTestFile('src/foo.test.ts'), true);
  assert.equal(isTestFile('src/foo.spec.js'), true);
  assert.equal(isTestFile('src/foo.e2e.ts'), true);
  assert.equal(isTestFile('e2e/login.cy.ts'), true);
});

test('isTestFile recognizes test directories', () => {
  assert.equal(isTestFile('src/__tests__/foo.ts'), true);
  assert.equal(isTestFile('test/foo.ts'), true);
  assert.equal(isTestFile('tests/foo.ts'), true);
  assert.equal(isTestFile('e2e/foo.ts'), true);
  assert.equal(isTestFile('cypress/e2e/foo.ts'), true);
});

test('isTestFile leaves production files alone', () => {
  assert.equal(isTestFile('src/foo.ts'), false);
  assert.equal(isTestFile('src/index.ts'), false);
  assert.equal(isTestFile('src/latest.ts'), false); // "test" substring must not match
});

test('sumProdAdded counts only code, non-test added lines', () => {
  const files = [
    { path: 'src/a.ts', added: 100 },
    { path: 'src/a.test.ts', added: 500 }, // test → excluded
    { path: 'package-lock.json', added: 9000 }, // non-code → excluded
    { path: 'src/b.ts', added: 50 },
  ];
  assert.equal(sumProdAdded(files), 150);
});

test('testFileViolations flags only test files over the limit', () => {
  const files = [
    { path: 'src/a.test.ts', total: 2500 },
    { path: 'src/b.spec.ts', total: 1999 },
    { path: 'src/huge.ts', total: 5000 }, // not a test → ignored
  ];
  const v = testFileViolations(files, 2000);
  assert.deepEqual(v, [{ path: 'src/a.test.ts', total: 2500 }]);
});

test('evaluate reports prod + test violations and overall failure', () => {
  const files = [
    { path: 'src/a.ts', added: 1500, total: 1500 },
    { path: 'src/a.test.ts', added: 2500, total: 2500 },
  ];
  const r = evaluate(files, { maxProd: 1000, maxTestFile: 2000 });
  assert.equal(r.ok, false);
  assert.equal(r.prodAdded, 1500);
  assert.equal(r.prodLimit, 1000);
  assert.equal(r.prodViolation, true);
  assert.deepEqual(r.testViolations, [{ path: 'src/a.test.ts', total: 2500 }]);
});

test('evaluate passes when within limits', () => {
  const files = [
    { path: 'src/a.ts', added: 200, total: 200 },
    { path: 'src/a.test.ts', added: 800, total: 800 },
    { path: 'README.md', added: 5000, total: 5000 },
  ];
  const r = evaluate(files, { maxProd: 1000, maxTestFile: 2000 });
  assert.equal(r.ok, true);
  assert.equal(r.prodAdded, 200);
  assert.equal(r.prodViolation, false);
  assert.deepEqual(r.testViolations, []);
});
