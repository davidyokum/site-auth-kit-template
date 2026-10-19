#!/usr/bin/env node
// `npm run setup`: the first step of a new site made from this template. It asks for the site's
// name, its family, its sender, its help mailbox, how people get an account, and the owner's email
// address, then writes them into site.config.ts (and puts personas.json on the site's own .test
// domain). The card style isn't asked: Quiet is the default (register E5); change `cardStyle` in
// site.config.ts if the site wants another.
//
// Run it again any time: each question offers the current value. Nothing here touches AWS, and it
// never asks for or writes a secret (every answer is public: it reaches the browser or AWS tags).
//
// Non-interactive (scripts, CI): pass every answer and --yes, e.g.
//   npm run setup -- --name "Budget Reports" --family personal --sender sign-in@yokum.app \
//     --help help@yokum.app --mode invite --owner-email owner@example.org --yes
// Domains mode adds --domains example.org,example.com [--requests-also] and --privacy /privacy.
// A person's own help address (register E4c: a site that's deliberately one person) needs
// --help-personal.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { MODES, applyAnswers, applyPersonaDomain, checkAnswers, describeAnswers } from './lib/setup-config.mjs';
import { loadSiteModules } from './lib/site-config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const { values: flags } = parseArgs({
  options: {
    name: { type: 'string' },
    family: { type: 'string' },
    sender: { type: 'string' },
    help: { type: 'string' },
    'help-personal': { type: 'boolean' },
    mode: { type: 'string' },
    domains: { type: 'string' },
    'requests-also': { type: 'boolean' },
    privacy: { type: 'string' },
    'owner-email': { type: 'string' },
    'owner-name': { type: 'string' },
    yes: { type: 'boolean', short: 'y' },
  },
  strict: true,
});

const { config, families } = await loadSiteModules(root);
const current = config.site;
const familyHelpMailbox = families.FAMILY_HELP_MAILBOX;
const familySender = families.FAMILY_SENDER;
const FAMILIES = [...families.SITE_FAMILIES];
const context = { familyHelpMailbox, familySender, families: FAMILIES, namesOwner: families.FAMILY_NAMES_OWNER };
const interactive = !flags.yes;
const rl = interactive ? createInterface({ input: stdin, output: stdout }) : null;

/** Asks once, with the current value as the default (Enter keeps it). */
async function ask(question, fallback, flag) {
  if (flag !== undefined) return flag;
  if (!rl) return fallback ?? '';
  const answer = (await rl.question(`${question}${fallback ? ` [${fallback}]` : ''}: `)).trim();
  return answer || (fallback ?? '');
}

/** Asks until `check` returns no problem. */
async function askUntil(question, fallback, flag, check) {
  for (;;) {
    const value = await ask(question, fallback, flag);
    const problem = check(value);
    if (!problem) return value;
    if (!rl || flag !== undefined) throw new Error(problem);
    console.log(`  ${problem}`);
  }
}

try {
  console.log('Set up this site (site.config.ts). Enter keeps the value in [brackets].\n');
  const name = await askUntil('Site name', String(current.name), flags.name, (v) => (v.trim() ? null : 'The site needs a name.'));
  const family = await askUntil(`Family (${FAMILIES.join(', ')})`, String(current.family), flags.family, (v) => (FAMILIES.includes(v.trim().toLowerCase()) ? null : `One of ${FAMILIES.join(', ')}.`));
  const fam = family.trim().toLowerCase();
  const probe = { name, family: fam, mode: 'invite', ownerEmail: 'owner@example.org' };
  const currentSender = current.email?.fromAddress ?? familySender[fam] ?? '';
  const sender = await askUntil(
    `Sender: the sign-in@ mailbox auth email comes from, on a domain verified in SES${familySender[fam] ? ` (the ${fam} family's is ${familySender[fam]})` : ''}`,
    String(currentSender),
    flags.sender,
    (v) => checkAnswers({ ...probe, sender: v || ' ' }, context).problems.find((p) => p.startsWith('Sender')) ?? null,
  );
  const replyTo = current.email?.replyTo;
  const currentHelp = (replyTo !== null && typeof replyTo === 'object' ? replyTo.address : replyTo) ?? familyHelpMailbox[fam] ?? '';
  let helpPersonal = flags['help-personal'] ?? (replyTo !== null && typeof replyTo === 'object' && replyTo.personal === true);
  const helpProblem = (v, personal) => checkAnswers({ ...probe, sender, help: v, helpPersonal: personal }, context).problems.find((p) => p.startsWith('Help mailbox')) ?? null;
  const help = await askUntil(
    `Help mailbox: the role-based address people write to for help signing in${familyHelpMailbox[fam] ? ` (the ${fam} family's is ${familyHelpMailbox[fam]})` : ''}`,
    String(currentHelp),
    flags.help,
    (v) => {
      const problem = helpProblem(v, false);
      // A person's own address passes only on purpose (register E4c): confirmed below, or --help-personal.
      if (problem && helpProblem(v, true) === null) return helpPersonal || rl ? null : `${problem} Pass --help-personal if that's on purpose.`;
      return problem;
    },
  );
  if (helpProblem(help, false) === null) {
    helpPersonal = false;
  } else if (!helpPersonal) {
    helpPersonal = /^y/i.test(await ask("That looks like a person's own address. Is that on purpose, for a site that's deliberately one person's (register E4c)? (y/N)", '', undefined));
    if (!helpPersonal) throw new Error('Use a role-based help mailbox (help@…, apps-help@…), then run setup again.');
  }
  const currentMode = current.accountCreation?.mode ?? 'invite';
  console.log('\nHow do people get an account?\n  invite   invite only (an admin invites; the default)\n  request  anyone may ask; an admin approves\n  domains  addresses on a list sign up themselves (needs the site web ACL first)\n  open     anyone signs up (needs the site web ACL first; README, "Account creation")');
  const mode = await askUntil(`Account creation (${MODES.join(', ')})`, currentMode, flags.mode, (v) => (MODES.includes(v.trim().toLowerCase()) ? null : `One of ${MODES.join(', ')}.`));
  const m = mode.trim().toLowerCase();
  let domains;
  let requestsAlso = false;
  if (m === 'domains') {
    domains = await askUntil('Domains that may sign up (comma-separated)', (current.accountCreation?.domains ?? []).join(', '), flags.domains, (v) => (v.trim() ? null : 'At least one domain.'));
    requestsAlso = flags['requests-also'] ?? (rl ? /^y/i.test(await ask('May everyone else request access? (y/N)', '', undefined)) : false);
  }
  let privacyNoticeUrl = current.privacyNoticeUrl ?? null;
  if (m === 'domains' || m === 'open') privacyNoticeUrl = await ask('Privacy notice (a site path like /privacy, or an https URL)', privacyNoticeUrl ?? '/privacy', flags.privacy);
  const ownerEmail = await askUntil("The owner's email address (the one person in the owner group)", String(current.ownerEmail ?? ''), flags['owner-email'], (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : 'An email address.'));
  const ownerName = context.namesOwner[fam] === true ? await ask("The owner's name, as the help screens show it (Enter to skip)", String(current.ownerName ?? ''), flags['owner-name']) : null;

  const { answers, problems } = checkAnswers({ name, family: fam, sender, help, helpPersonal, mode: m, domains, requestsAlso, privacyNoticeUrl, ownerEmail, ownerName }, context);
  if (problems.length > 0) throw new Error(problems.join('\n'));
  console.log(`\nThis goes into site.config.ts:\n${describeAnswers(answers).join('\n')}\n`);
  if (rl && /^n/i.test(await ask('Write it? (Y/n)', '', undefined))) {
    console.log('Nothing was written.');
    process.exit(0);
  }

  const configPath = join(root, 'site.config.ts');
  writeFileSync(configPath, applyAnswers(readFileSync(configPath, 'utf8'), answers));
  const personasPath = join(root, 'personas.json');
  writeFileSync(personasPath, applyPersonaDomain(readFileSync(personasPath, 'utf8'), answers.project));
  console.log('Wrote site.config.ts and personas.json. Next:');
  console.log('  - deploy.config.json: the AWS profile and account this site deploys to (README, "Start a new site", step 4)');
  if (answers.fromAddress !== null) console.log(`  - verify ${answers.sender.slice(answers.sender.indexOf('@') + 1)} in Amazon SES in the account this site deploys to (SPF, DKIM, and DMARC published)`);
  if (m === 'domains' || m === 'open') console.log('  - siteWaf in site.config.ts: the site web ACL and its JavaScript integration (required on sign-up sites; README, "Account creation")');
  if (m !== 'invite') console.log(`  - ${m === 'request' ? 'the request page' : 'the sign-up page'} links your privacy notice: make sure it exists`);
  console.log('  - npm run check, then commit');
} catch (error) {
  console.error(`setup: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  rl?.close();
}
