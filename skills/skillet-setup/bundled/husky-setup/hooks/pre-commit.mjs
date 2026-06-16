// pre-commit: lint + format + secret scan on STAGED files via lint-staged.
// (lint-staged config wires eslint/biome/prettier + secretlint, per detection.)
import { bin } from './_util.mjs';

bin(['lint-staged']);
