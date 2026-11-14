#!/usr/bin/env node
// npm run deploy [-- --yes] [-- --wait-for-domain <minutes>]
//
// Puts this site online with auth-kit's `deploy` (auth-kit ADR 0028): the GitHub repository, the
// Amplify service role and app, the branch with APP_ORIGIN, the first build, the compute role, the
// site's address (it prints the DNS records to add), and then the owner's first-visit invite. Without
// --yes it only reads and prints the plan: show that list to the site's owner, then run it with --yes.
// Every step skips what exists, so run it again after adding the DNS records.
//
// It reads everything from site.config.ts and deploy.config.json, and refuses before starting while
// the site has no address, the backdrop isn't the owner's choice, or the repo or web ACL isn't set.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDeployConfig } from './lib/deploy-config.mjs';
import { deployArgs, deployBlockers } from './lib/deploy-plan.mjs';
import { loadSiteModules } from './lib/site-config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

try {
  const config = parseDeployConfig(readFileSync(join(root, 'deploy.config.json'), 'utf8'));
  const { config: siteModule, families } = await loadSiteModules(root);
  const site = /** @type {any} */ (siteModule.site);
  const blockers = deployBlockers(site, config);
  if (blockers.length > 0) {
    console.error(`deploy: not yet:\n- ${blockers.join('\n- ')}`);
    process.exit(1);
  }
  const args = deployArgs(site, families.FAMILY_HELP_MAILBOX, /** @type {{ repo: string }} */ (config), process.argv.slice(2));
  const result = spawnSync('npx', args, { cwd: root, stdio: 'inherit' });
  process.exit(result.status ?? 1);
} catch (error) {
  console.error(`deploy: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
