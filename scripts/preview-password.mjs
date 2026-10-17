#!/usr/bin/env node
// Puts a preview branch behind an Amplify branch password (03 §1 Tier 1: drafts and every
// non-production branch sit behind a host-level password, no app code involved).
//
//   npm run preview:password -- --app-id <appId> --branch <name>     one existing branch
//   npm run preview:password -- --app-id <appId> --auto-branches     every branch Amplify creates later
//
// Runs the account check first (deploy.config.json), asks for the password without echoing it,
// and hands it to the AWS CLI in a 0600 temp file that's deleted at once, never as an argument
// (arguments show up in the process list). Keep the password in your password manager.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { assertAccount } from './lib/assert-account.mjs';
import { parsePreviewArgs, previewPasswordProblem, previewPasswordRequest } from './lib/preview-password.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function refuse(message) {
  console.error(`preview-password: ${message}`);
  process.exit(1);
}

/** Reads a line without echoing it. */
function askHidden(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (text) => {
      if (!muted) process.stdout.write(text);
    };
    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

let args;
try {
  args = parsePreviewArgs(process.argv.slice(2));
} catch (error) {
  refuse(error instanceof Error ? error.message : String(error));
}

let config;
try {
  config = assertAccount(root);
} catch (error) {
  refuse(error instanceof Error ? error.message : String(error));
}
console.log(`preview-password: profile "${config.awsProfile}" reaches account ${config.awsAccountId}, as deploy.config.json declares.`);

const password = await askHidden(`Password for user "${args.username}" (not shown): `);
const problem = previewPasswordProblem(password);
if (problem) refuse(problem);
if ((await askHidden('Again: ')) !== password) refuse("the two entries don't match; nothing changed.");

const { command, input } = previewPasswordRequest(args, password);
const dir = mkdtempSync(join(tmpdir(), 'preview-password-'));
const file = join(dir, 'input.json');
let result;
try {
  writeFileSync(file, JSON.stringify(input), { mode: 0o600 });
  // --query prints only the branch name or app ID: Amplify's full response echoes basicAuthCredentials.
  result = spawnSync('aws', [...command, '--cli-input-json', `file://${file}`, '--profile', config.awsProfile, '--region', config.region, '--output', 'json', '--query', 'branch.branchName || app.appId'], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, AWS_PAGER: '' },
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (result.status !== 0) refuse('the AWS CLI refused the change (see above); nothing else was changed.');
console.log(
  args.target.kind === 'branch'
    ? `preview-password: ${args.target.branch} now asks for the password. Share it only through your password manager.`
    : 'preview-password: branches Amplify creates from now on start behind the password.',
);
