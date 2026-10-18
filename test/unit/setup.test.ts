/**
 * `npm run setup` (scripts/setup.mjs, scripts/lib/setup-config.mjs): the answers are checked, written
 * into the template's own site.config.ts on the lines it expects, and the result is a config the
 * site accepts. It never writes a secret.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parsePersonas } from 'auth-kit/dev';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { siteConfigProblems, type CheckedSite } from '@/lib/site-checks';
import { applyAnswers, applyPersonaDomain, checkAnswers, describeAnswers, replaceConfigLine, slugify, tsString } from '@/scripts/lib/setup-config.mjs';
import { FAMILY_HELP_MAILBOX, FAMILY_NAMES_OWNER, SITE_FAMILIES } from '@/site.families';

const ROOT = join(import.meta.dirname, '..', '..');
const context = { familyHelpMailbox: FAMILY_HELP_MAILBOX, families: SITE_FAMILIES, namesOwner: FAMILY_NAMES_OWNER };
const good = { name: 'Budget Reports', family: 'personal', help: 'help@yokumlab.com', mode: 'invite', ownerEmail: 'Owner@Example.org' };

/** Loads a site.config.ts text the way the scripts do (TypeScript's transpiler, then import). */
async function load(text: string): Promise<{ site: CheckedSite & Record<string, unknown> }> {
  const dir = mkdtempSync(join(tmpdir(), 'setup-test-'));
  try {
    const transpile = (source: string, fileName: string) =>
      ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName }).outputText;
    writeFileSync(join(dir, 'site.families.mjs'), transpile(readFileSync(join(ROOT, 'site.families.ts'), 'utf8'), 'site.families.ts'));
    writeFileSync(join(dir, 'site.config.mjs'), transpile(text, 'site.config.ts').replace(/from\s+['"]\.\/site\.families['"]/g, "from './site.families.mjs'"));
    return (await import(pathToFileURL(join(dir, 'site.config.mjs')).href)) as { site: CheckedSite & Record<string, unknown> };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('the answers (checkAnswers)', () => {
  it('normalizes them: a slug from the name, lowercase addresses, the family’s own mailbox written as null', () => {
    const { answers, problems } = checkAnswers(good, context);
    expect(problems).toEqual([]);
    expect(answers).toMatchObject({ name: 'Budget Reports', project: 'budget-reports', family: 'personal', replyTo: null, help: 'help@yokumlab.com', ownerEmail: 'owner@example.org', ownerName: null });
    expect(checkAnswers({ ...good, help: 'Reports-Help@Example.org' }, context).answers.replyTo).toBe('reports-help@example.org');
  });

  it('refuses what auth-kit would refuse later: no help mailbox, a placeholder or personal one, an unknown family or mode', () => {
    expect(checkAnswers({ ...good, family: 'unc', help: '' }, context).problems.join(' ')).toMatch(/needs a help address/);
    expect(checkAnswers({ ...good, help: 'apps-help@replace-me.invalid' }, context).problems.join(' ')).toMatch(/placeholder/);
    expect(checkAnswers({ ...good, help: 'jordan.lee@example.org' }, context).problems.join(' ')).toMatch(/person's own address/);
    expect(checkAnswers({ ...good, family: 'acme' }, context).problems.join(' ')).toMatch(/family must be one of/);
    expect(checkAnswers({ ...good, mode: 'anyone' }, context).problems.join(' ')).toMatch(/mode must be one of/);
    expect(checkAnswers({ ...good, ownerEmail: 'not an address' }, context).problems.join(' ')).toMatch(/owner's email/);
    expect(checkAnswers({ ...good, name: 'Line\nbreak' }, context).problems.join(' ')).toMatch(/line breaks/);
  });

  it('asks a sign-up site for its domains and privacy notice', () => {
    expect(checkAnswers({ ...good, mode: 'domains' }, context).problems.join(' ')).toMatch(/at least one domain[\s\S]*privacy notice/);
    const { answers, problems } = checkAnswers({ ...good, mode: 'domains', domains: ' Example.org, @example.com ', requestsAlso: true, privacyNoticeUrl: '/privacy' }, context);
    expect(problems).toEqual([]);
    expect(answers.accountCreation).toEqual({ mode: 'domains', domains: ['example.org', 'example.com'], requestsAlso: true });
    expect(checkAnswers({ ...good, mode: 'open', privacyNoticeUrl: 'ftp://x' }, context).problems.join(' ')).toMatch(/site path/);
  });

  it('keeps the owner’s name only for families whose help screens name owners', () => {
    expect(checkAnswers({ ...good, ownerName: 'Jordan Lee' }, context).answers.ownerName).toBeNull();
    expect(checkAnswers({ ...good, family: 'unc', help: 'reports-help@example.org', ownerName: 'Jordan Lee' }, context).answers.ownerName).toBe('Jordan Lee');
  });
});

describe('writing site.config.ts (applyAnswers)', () => {
  const template = readFileSync(join(ROOT, 'site.config.ts'), 'utf8');

  it('rewrites only the setup lines of the template’s own file, and the result is a config the site accepts', async () => {
    const { answers } = checkAnswers({ ...good, mode: 'domains', domains: 'example.org', requestsAlso: true, privacyNoticeUrl: '/privacy' }, context);
    const written = applyAnswers(template, answers);
    const { site } = await load(written);
    expect(site).toMatchObject({
      name: 'Budget Reports',
      project: 'budget-reports',
      family: 'personal',
      ownerEmail: 'owner@example.org',
      ownerName: null,
      accountCreation: { mode: 'domains', domains: ['example.org'], requestsAlso: true },
      privacyNoticeUrl: '/privacy',
      alertEmails: ['owner@example.org'],
      inviteDomains: ['example.org'],
      email: { fromAddress: 'noreply@example.com', replyTo: null },
    });
    expect(siteConfigProblems(site)).toEqual([]);
    // Everything else is untouched: the same number of lines, and the backdrop line as it was.
    expect(written.split('\n').length).toBe(template.split('\n').length);
    expect(written).toContain('  backdrop: null as SiteBackdrop | null,');
  });

  it('writes a site’s own help mailbox, and is idempotent', async () => {
    const { answers } = checkAnswers({ ...good, help: 'reports-help@example.org' }, context);
    const once = applyAnswers(template, answers);
    expect(applyAnswers(once, answers)).toBe(once);
    expect((await load(once)).site.email).toEqual({ fromAddress: 'noreply@example.com', replyTo: 'reports-help@example.org' });
  });

  it('refuses a file whose setup line isn’t in the one-line form, instead of guessing', () => {
    expect(() => replaceConfigLine('  name:\n    "x",\n', '  ', 'name', "'y'")).toThrow(/exactly one line/);
  });

  it('quotes values as TypeScript strings', () => {
    expect(tsString("O'Brien \\ Co")).toBe("'O\\'Brien \\\\ Co'");
    expect(slugify('  Café Reports: 2027! ')).toBe('cafe-reports-2027');
  });

  it('never writes a secret: no password, key, token, or account ID among the answers it writes', () => {
    const { answers } = checkAnswers(good, context);
    expect(Object.keys(answers).sort()).toEqual(['accountCreation', 'family', 'help', 'name', 'ownerEmail', 'ownerName', 'privacyNoticeUrl', 'project', 'replyTo']);
    expect(describeAnswers(answers).join('\n')).not.toMatch(/password|secret|token|\d{12}/i);
  });
});

describe('personas.json (applyPersonaDomain)', () => {
  it('moves every persona onto the site’s own .test domain, and auth-kit still accepts the file', () => {
    const text = applyPersonaDomain(readFileSync(join(ROOT, 'personas.json'), 'utf8'), 'budget-reports');
    const personas = JSON.parse(text) as { email: string }[];
    for (const p of personas) expect(p.email).toMatch(/@budget-reports\.test$/);
    expect(parsePersonas(personas).length).toBe(personas.length);
  });
});
