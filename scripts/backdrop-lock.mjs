#!/usr/bin/env node
// npm run backdrop:lock: keeps the backdrop the site draws now, by writing it into site.config.ts as
// literal values, locked (auth-kit ADR 0020). Until then it's only a proposal from the site's name,
// and production builds refuse it. Local only: no AWS, no network.
//
// Already locked: says so and changes nothing (choose another with `npm run backdrop:pick`).
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeChange, lockChoiceFor, writeBackdropChoice } from './lib/backdrop-config.mjs';
import { loadSiteConfig } from './lib/site-config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

try {
  const { site } = await loadSiteConfig(root);
  const choice = lockChoiceFor(site);
  if (!choice) {
    const b = /** @type {{ style: string, seed: string, styleVersion: number }} */ (site.backdrop);
    console.log(`backdrop:lock: already locked (${b.style} v${b.styleVersion}, seed ${b.seed}). To choose another: npm run backdrop:pick`);
    process.exit(0);
  }
  const result = await writeBackdropChoice(root, choice);
  console.log(`backdrop:lock: locked. ${describeChange(result)}`);
  console.log('Commit site.config.ts. Renaming the site or upgrading auth-kit won’t change this backdrop.');
} catch (error) {
  console.error(`backdrop:lock: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
