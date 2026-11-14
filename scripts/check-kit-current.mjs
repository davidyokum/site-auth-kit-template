#!/usr/bin/env node
// CI's "auth-kit is current" check: fails when a newer auth-kit release exists than the one in
// package.json, so a site made from this template never starts behind the kit (auth-kit ADR 0028:
// fixes shipped in the kit and didn't reach the sites). The fix is one command:
//   npx auth-kit upgrade <version>
// Reads GitHub's release list (GITHUB_TOKEN, when set, only raises the rate limit).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kitVersionOf, newestRelease } from './lib/kit-version.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const current = kitVersionOf(pkg.dependencies?.['auth-kit'] ?? '');
if (!current) {
  console.error('check-kit-current: package.json has no auth-kit release tarball URL.');
  process.exit(1);
}
const response = await fetch('https://api.github.com/repos/davidyokum/auth-kit/releases?per_page=10', {
  headers: { accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN && { authorization: `Bearer ${process.env.GITHUB_TOKEN}` }) },
});
if (!response.ok) {
  // Couldn't check is not "current": say so and fail (auth-kit: fail closed).
  console.error(`check-kit-current: GitHub answered ${response.status}; couldn't check.`);
  process.exit(1);
}
const newest = newestRelease(await response.json());
if (!newest) {
  console.error('check-kit-current: no auth-kit release found; couldn’t check.');
  process.exit(1);
}
if (newest !== current) {
  console.error(`check-kit-current: this site is on auth-kit ${current}; ${newest} is out. Run: npx auth-kit upgrade ${newest}, read its CHANGELOG section, then npm run check.`);
  process.exit(1);
}
console.log(`check-kit-current: on auth-kit ${current}, the newest release.`);
