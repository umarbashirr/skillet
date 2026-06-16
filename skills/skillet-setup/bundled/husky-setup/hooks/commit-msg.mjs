// commit-msg: enforce Conventional Commits via commitlint.
import { bin } from './_util.mjs';

const msgFile = process.argv[2];
if (!msgFile) {
  console.error('skillet commit-msg: no message file passed by git.');
  process.exit(1);
}
bin(['commitlint', '--edit', msgFile]);
