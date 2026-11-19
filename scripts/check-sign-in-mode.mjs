#!/usr/bin/env node
// Runs in the Amplify build, before the backend deploys (amplify.yml): refuses to deploy a site set to
// "Simple: code only" over a pool that's Full (auth-kit ADR 0029: Full to Simple isn't offered). A Full
// site needs nothing here. It reads the branch's current outputs with the build's own credentials
// (`ampx generate outputs`); a branch with no backend yet is a new site, which starts Simple.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isNoBackendYet, signInModeGuard } from './lib/sign-in-mode-guard.mjs';
import { loadSiteConfig } from './lib/site-config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { site } = await loadSiteConfig(root);
const signIn = /** @type {{ mode?: unknown } | undefined} */ (site.signIn);

if (signIn?.mode !== 'simple') {
  console.log('check-sign-in-mode: Full sign-in, nothing to check.');
  process.exit(0);
}
const branch = process.env.AWS_BRANCH;
const appId = process.env.AWS_APP_ID;
if (!branch || !appId) {
  console.log('check-sign-in-mode: not in an Amplify build (no AWS_BRANCH / AWS_APP_ID); the build checks this before it deploys.');
  process.exit(0);
}
const dir = mkdtempSync(join(tmpdir(), 'deployed-outputs-'));
try {
  const run = spawnSync('npx', ['ampx', 'generate', 'outputs', '--branch', branch, '--app-id', appId, '--out-dir', dir], { cwd: root, encoding: 'utf8' });
  const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  let deployed;
  if (run.status === 0) deployed = { outputs: JSON.parse(readFileSync(join(dir, 'amplify_outputs.json'), 'utf8')) };
  else if (isNoBackendYet(output)) deployed = { noBackendYet: true };
  else deployed = { error: output.trim().split('\n').slice(-3).join(' ').slice(0, 300) || `ampx exited ${run.status}` };
  const verdict = signInModeGuard(signIn, deployed);
  console[verdict.ok ? 'log' : 'error'](`check-sign-in-mode: ${verdict.message}`);
  process.exitCode = verdict.ok ? 0 : 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
