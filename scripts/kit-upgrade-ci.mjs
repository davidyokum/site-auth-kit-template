#!/usr/bin/env node
// The "auth-kit upgrade" workflow's checks (.github/workflows/kit-upgrade.yml; rules in
// scripts/lib/kit-upgrade.mjs; auth-kit ADR 0030). CI only: it reads git and files, never AWS.
//
//   plan   --base <ref> [--dir <dir>]                 what the PR moves to, and whether the lockfile is done
//   check  --base <ref> [--dir <dir>] --tarball <tgz> only auth-kit's lines changed, pinned to this tarball
//   decide --update <type> --notes <file>             the auth-kit/auto-merge status
//
// Each prints key=value lines for $GITHUB_OUTPUT and exits 1 with the reason when the PR isn't a
// kit-only upgrade.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  autoMergeDecision,
  changedFileProblems,
  kitVersionOfUrl,
  lockfileProblems,
  lockPinsRelease,
  packageJsonProblems,
  releaseMeta,
  updateType,
} from './lib/kit-upgrade.mjs';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { base: { type: 'string' }, dir: { type: 'string', default: '.' }, tarball: { type: 'string' }, update: { type: 'string' }, notes: { type: 'string' } },
});
const [command] = positionals;

function fail(lines) {
  for (const line of [].concat(lines)) console.error(`kit-upgrade: ${line}`);
  process.exit(1);
}

function gitShow(ref, path) {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  } catch {
    fail(`couldn't read ${path} at ${ref}.`);
  }
}

function sitePath(name) {
  return values.dir === '.' ? name : join(values.dir, name);
}

function read() {
  if (!values.base) fail('--base <ref> is required.');
  const basePkg = JSON.parse(gitShow(values.base, sitePath('package.json')));
  const baseLock = JSON.parse(gitShow(values.base, sitePath('package-lock.json')));
  const headPkg = JSON.parse(readFileSync(sitePath('package.json'), 'utf8'));
  const headLock = JSON.parse(readFileSync(sitePath('package-lock.json'), 'utf8'));
  const field = headPkg.dependencies?.['auth-kit'] !== undefined ? 'dependencies' : 'devDependencies';
  const from = kitVersionOfUrl(basePkg[field]?.['auth-kit']);
  const to = kitVersionOfUrl(headPkg[field]?.['auth-kit']);
  if (!from) fail(`the base branch's package.json has no auth-kit release tarball URL.`);
  if (!to) fail(`package.json's auth-kit isn't a release tarball URL from github.com/davidyokum/auth-kit.`);
  const update = updateType(from, to);
  if (!update) fail(`${to} isn't newer than ${from}.`);
  const changed = execFileSync('git', ['diff', '--name-only', `${values.base}...HEAD`], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const problems = [...changedFileProblems(changed, values.dir), ...packageJsonProblems(basePkg, headPkg)];
  if (problems.length > 0) fail(problems);
  return { baseLock, headLock, field, from, to, update };
}

function output(entries) {
  for (const [key, value] of Object.entries(entries)) console.log(`${key}=${String(value).replace(/\n/g, ' ')}`);
}

if (command === 'plan') {
  const { headLock, field, from, to, update } = read();
  output({ from, to, update, needs_lock: !lockPinsRelease(headLock, field, to) });
} else if (command === 'check') {
  const { baseLock, headLock, field, from, to, update } = read();
  if (!values.tarball) fail('--tarball <path> is required.');
  const integrity = `sha512-${createHash('sha512').update(readFileSync(values.tarball)).digest('base64')}`;
  const problems = lockfileProblems(baseLock, headLock);
  if (!lockPinsRelease(headLock, field, to, integrity)) problems.push(`package-lock.json doesn't pin auth-kit ${to}'s attested tarball (${integrity}).`);
  if (problems.length > 0) fail(problems);
  console.error(`kit-upgrade: auth-kit ${from} → ${to} (${update}); only the kit's lines changed, pinned to the attested tarball.`);
  output({ from, to, update });
} else if (command === 'decide') {
  if (!values.update || !values.notes) fail('--update <type> and --notes <file> are required.');
  const meta = releaseMeta(readFileSync(values.notes, 'utf8'));
  const decision = autoMergeDecision({ update: values.update, meta });
  output({ state: decision.state, description: decision.description.slice(0, 139), security: meta?.security ?? '' });
} else {
  fail('usage: kit-upgrade-ci.mjs plan|check|decide (see the comment at the top).');
}
