/**
 * A public repo: no secrets, no real identifiers, no environment files (03 §2 Foundation: "secrets
 * live in Secrets Manager or Amplify secret(); never in git").
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const tracked = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const text = tracked.filter((f) => /\.(ts|tsx|mts|mjs|js|json|md|yml|yaml|css|txt|example)$/.test(f) && f !== 'package-lock.json');
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8');

// Obviously fake placeholders used in docs and tests.
const FAKE_ACCOUNTS = new Set(['000000000000', '111122223333', '444455556666']);
const FAKE_POOLS = new Set(['us-east-1_PlaceholderPool']);

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

  it('has no AWS account IDs', () => {
    const hits = text.flatMap((f) => [...read(f).matchAll(/(?<![\d.])\d{12}(?![\d.])/g)].map((m) => m[0]).filter((id) => !FAKE_ACCOUNTS.has(id)).map((id) => `${f}: ${id}`));
    expect(hits).toEqual([]);
  });

  it('has no AWS access keys or private keys', () => {
    expect(text.filter((f) => /\b(AKIA|ASIA)[0-9A-Z]{16}\b/.test(read(f)))).toEqual([]);
    expect(text.filter((f) => /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(read(f)))).toEqual([]);
  });

  it('has no real-looking Cognito pool IDs or Amplify app IDs', () => {
    const pools = text.flatMap((f) => [...read(f).matchAll(/\b[a-z]{2}-[a-z]+-\d_[A-Za-z0-9]{6,}\b/g)].map((m) => m[0]).filter((id) => !FAKE_POOLS.has(id)).map((id) => `${f}: ${id}`));
    expect(pools).toEqual([]);
    const apps = text.flatMap((f) => [...read(f).matchAll(/\bd(?=[a-z0-9]*\d)[a-z0-9]{13}\b/g)].map((m) => `${f}: ${m[0]}`));
    expect(apps).toEqual([]);
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
