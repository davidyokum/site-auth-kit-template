#!/usr/bin/env node
// npm run backdrop:set -- <style>:<seed>:<version> --owner-chose
//
// Writes the backdrop the site's owner chose into site.config.ts, locked, as the picker's "Use this
// one" does (auth-kit ADR 0021). For when the owner chose without the picker in front of them: from
// screenshots of the picker's variations, or by naming a style. The picker shows each variation's
// style, seed, and version.
//
// --owner-chose says the owner picked it. Without it nothing is written: the site's look is the
// owner's decision, never a default an agent keeps for them (auth-kit ADR 0028). Local only: no AWS,
// no network.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { describeChange, parseChoice, writeBackdropChoice } from './lib/backdrop-config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

try {
  const { values, positionals } = parseArgs({ options: { 'owner-chose': { type: 'boolean' } }, allowPositionals: true, strict: true });
  if (positionals.length !== 1) throw new Error('give one choice, as the picker shows it: npm run backdrop:set -- contours:mfpxqqpj:2 --owner-chose');
  const choice = parseChoice(positionals[0]);
  if (values['owner-chose'] !== true) {
    throw new Error(
      `nothing written. The backdrop is the site owner's choice: show them the picker's variations (npm run backdrop:pick), and once they've picked one, run this again with --owner-chose.`,
    );
  }
  const result = await writeBackdropChoice(root, choice);
  console.log(`backdrop:set: ${describeChange(result)}`);
  console.log('Commit site.config.ts. Renaming the site or upgrading auth-kit won’t change this backdrop.');
} catch (error) {
  console.error(`backdrop:set: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
