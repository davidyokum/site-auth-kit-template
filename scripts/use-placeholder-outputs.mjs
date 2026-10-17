#!/usr/bin/env node
// Copies the clearly fake ci/amplify_outputs.placeholder.json to amplify_outputs.json, so the app
// builds and the tests run without AWS (CI, or a first look before you've deployed a sandbox).
//
// It never overwrites an existing amplify_outputs.json: that file is your sandbox's (or a branch's),
// and replacing it would silently point the app at a pool that doesn't exist. Pass --force in CI only.
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'ci', 'amplify_outputs.placeholder.json');
const target = join(root, 'amplify_outputs.json');
const force = process.argv.includes('--force');

if (existsSync(target) && !force) {
  const current = readFileSync(target, 'utf8');
  if (current === readFileSync(source, 'utf8')) {
    console.log('amplify_outputs.json is already the placeholder.');
  } else {
    console.log('amplify_outputs.json exists (your sandbox or a branch wrote it); leaving it alone.');
  }
  process.exit(0);
}

copyFileSync(source, target);
console.log('Wrote the PLACEHOLDER amplify_outputs.json: fake IDs, nothing can sign in. Run `npm run sandbox` for a real pool.');
