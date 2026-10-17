#!/usr/bin/env node
// The account-assert preflight (03 §3): before anything touches AWS, prove the configured profile
// reaches the account this site declares, and refuse otherwise.
//
//   node scripts/preflight.mjs                                   check only
//   node scripts/preflight.mjs --exec ampx sandbox               check, then run `npx ampx sandbox --profile <p>`
//   node scripts/preflight.mjs --pass-account --exec auth-kit seed-personas
//                                                                ...and pass `--account <id>` too
//
// It reads deploy.config.json ({ awsProfile, awsAccountId, region }) and runs
// `aws sts get-caller-identity --profile <awsProfile>` (read-only). Exit codes: 0 ok, 1 refused.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertAccount } from './lib/assert-account.mjs';
import { execPlan } from './lib/deploy-config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function refuse(message) {
  console.error(`preflight: ${message}`);
  process.exit(1);
}

const argv = process.argv.slice(2);
const execAt = argv.indexOf('--exec');
const flags = execAt === -1 ? argv : argv.slice(0, execAt);
const command = execAt === -1 ? [] : argv.slice(execAt + 1);
for (const flag of flags) if (flag !== '--pass-account') refuse(`unknown option ${flag}`);

let config;
try {
  config = assertAccount(root);
} catch (error) {
  refuse(error instanceof Error ? error.message : String(error));
}
console.log(`preflight: profile "${config.awsProfile}" reaches account ${config.awsAccountId}, as deploy.config.json declares.`);

if (command.length > 0) {
  let plan;
  try {
    plan = execPlan(config, command, { passAccount: flags.includes('--pass-account') });
  } catch (error) {
    refuse(error instanceof Error ? error.message : String(error));
  }
  console.log(`preflight: running ${[plan.file, ...plan.args].join(' ')}`);
  const result = spawnSync(plan.file, plan.args, {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, AWS_PROFILE: config.awsProfile, AWS_REGION: config.region, AWS_DEFAULT_REGION: config.region },
  });
  process.exit(result.status ?? 1);
}
