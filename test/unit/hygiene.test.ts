/**
 * A public repo: no secrets, no real identifiers, no environment files (03 §2 Foundation: "secrets
 * live in Secrets Manager or Amplify secret(); never in git").
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allowedIds, FAKE_ACCOUNT_IDS, FAKE_APP_IDS, unknownIds } from './support/identifiers';

const ROOT = join(import.meta.dirname, '..', '..');
const tracked = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const text = tracked.filter((f) => /\.(ts|tsx|mts|mjs|js|json|md|yml|yaml|css|txt|example)$/.test(f) && f !== 'package-lock.json');
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8');

// Obviously fake placeholders used in docs and tests (account and app IDs: ./support/identifiers.ts).
const FAKE_POOLS = new Set(['us-east-1_PlaceholderPool']);

// The fakes, plus the site's own account and Amplify app IDs once deploy.config.json declares them
// (a real site's repo). The template's placeholder config adds nothing.
const allowed = allowedIds(JSON.parse(read('deploy.config.json')));

describe('the repo holds no secrets or real identifiers', () => {
  it('scans a meaningful number of files', () => {
    expect(text.length).toBeGreaterThan(40);
  });

  it('commits no environment files (only .env.local.example)', () => {
    expect(tracked.filter((f) => /(^|\/)\.env/.test(f) && !f.endsWith('.env.local.example'))).toEqual([]);
  });

  it('commits no generated amplify_outputs.json (only the CI placeholder)', () => {
    expect(tracked.filter((f) => /amplify_outputs.*\.json$/.test(f))).toEqual(['ci/amplify_outputs.placeholder.json']);
  });

  it('ignores .env files and generated outputs', () => {
    const ignore = read('.gitignore');
    expect(ignore).toMatch(/^\.env\*$/m);
    expect(ignore).toMatch(/^amplify_outputs\*\.json$/m);
  });

  it('has no AWS account IDs but the fakes and the site’s own (deploy.config.json)', () => {
    expect(text.flatMap((f) => unknownIds(read(f), allowed).accounts.map((id) => `${f}: ${id}`))).toEqual([]);
  });

  it('has no AWS access keys or private keys', () => {
    expect(text.filter((f) => /\b(AKIA|ASIA)[0-9A-Z]{16}\b/.test(read(f)))).toEqual([]);
    expect(text.filter((f) => /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(read(f)))).toEqual([]);
  });

  it('has no real-looking Cognito pool IDs, and no Amplify app IDs but the fakes and the site’s own', () => {
    const pools = text.flatMap((f) => [...read(f).matchAll(/\b[a-z]{2}-[a-z]+-\d_[A-Za-z0-9]{6,}\b/g)].map((m) => m[0]).filter((id) => !FAKE_POOLS.has(id)).map((id) => `${f}: ${id}`));
    expect(pools).toEqual([]);
    expect(text.flatMap((f) => unknownIds(read(f), allowed).appIds.map((id) => `${f}: ${id}`))).toEqual([]);
  });

  it('persona addresses never deliver mail (.test only)', () => {
    const personas = JSON.parse(read('personas.json')) as { email: string }[];
    for (const p of personas) expect(p.email).toMatch(/\.test$/);
  });

  it('carries no employer or government branding', () => {
    // This file is skipped: it has to spell the patterns out.
    const hits = text.filter((f) => f !== 'test/unit/hygiene.test.ts' && /\bosbm\b|\.nc\.gov\b|north carolina/i.test(read(f)));
    expect(hits).toEqual([]);
  });
});

describe('the ID allow-list (test/unit/support/identifiers.ts)', () => {
  const none = { accounts: new Set<string>(), appIds: new Set<string>() };
  const page = 'Account 111122223333 serves https://main.d1111222233334.amplifyapp.com; 444455556666 runs d4444555566667.';

  it('lets the site’s own declared IDs through', () => {
    const own = allowedIds({ awsAccountId: '111122223333', amplifyAppId: 'd1111222233334' }, none);
    expect(unknownIds('Account 111122223333 serves https://main.d1111222233334.amplifyapp.com.', own)).toEqual({ accounts: [], appIds: [] });
  });

  it('still refuses any other account or app ID', () => {
    const own = allowedIds({ awsAccountId: '111122223333', amplifyAppId: 'd1111222233334' }, none);
    expect(unknownIds(page, own)).toEqual({ accounts: ['444455556666'], appIds: ['d4444555566667'] });
  });

  it('adds nothing for the template’s placeholder config, or for IDs of the wrong shape', () => {
    for (const config of [
      { awsAccountId: '000000000000', amplifyAppId: null },
      { awsAccountId: 111122223333, amplifyAppId: 'D1111222233334' },
      { awsAccountId: '11112222333', amplifyAppId: 'd111122223333' },
      null,
    ]) {
      expect(allowedIds(config, none)).toEqual(none);
    }
    expect(unknownIds('000000000000', allowedIds({ awsAccountId: '000000000000' }, none)).accounts).toEqual(['000000000000']);
  });

  it('starts from the fakes by default, and counts only standalone 12-digit numbers', () => {
    const fakes = allowedIds({});
    expect(fakes).toEqual({ accounts: FAKE_ACCOUNT_IDS, appIds: FAKE_APP_IDS });
    expect(unknownIds(page, fakes)).toEqual({ accounts: [], appIds: [] });
    expect(unknownIds('1111222233334444 and 0.111122223333', none).accounts).toEqual([]);
  });
});
