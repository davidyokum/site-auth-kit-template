import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { accountMismatch, execPlan, parseCallerIdentity, parseDeployConfig, PLACEHOLDER_ACCOUNT_ID } from '../../scripts/lib/deploy-config.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const good = { awsProfile: 'personal', awsAccountId: '111122223333', region: 'us-east-1' };

describe('the account-assert preflight (scripts/preflight.mjs)', () => {
  it('this repo’s deploy.config.json: the template’s placeholder is refused; a real site’s config parses', () => {
    const text = readFileSync(join(ROOT, 'deploy.config.json'), 'utf8');
    const raw = JSON.parse(text) as { awsAccountId?: unknown; amplifyAppId?: unknown };
    expect(PLACEHOLDER_ACCOUNT_ID).toBe('000000000000');
    if (raw.awsAccountId === PLACEHOLDER_ACCOUNT_ID) {
      // The template as shipped: the placeholder account must be replaced first, and no app ID yet.
      expect(() => parseDeployConfig(text)).toThrow(/placeholder/);
      expect(raw.amplifyAppId).toBeNull();
    } else {
      // A site made from it: its real account (and app ID, once it has one) parse.
      expect(parseDeployConfig(text)).toMatchObject({ awsAccountId: raw.awsAccountId, amplifyAppId: raw.amplifyAppId ?? null });
    }
  });

  it('accepts a complete config; amplifyAppId is optional and null until the Amplify app exists', () => {
    expect(parseDeployConfig(JSON.stringify(good))).toEqual({ ...good, amplifyAppId: null });
    expect(parseDeployConfig(JSON.stringify({ ...good, amplifyAppId: null }))).toEqual({ ...good, amplifyAppId: null });
  });

  it('accepts a filled config with the site’s Amplify app ID', () => {
    const filled = { ...good, amplifyAppId: 'd1111222233334' };
    expect(parseDeployConfig(JSON.stringify(filled))).toEqual(filled);
  });

  it('refuses an amplifyAppId that isn’t an Amplify app ID', () => {
    for (const bad of ['D1111222233334', 'd111122223333', 'd11112222333344', 'x1111222233334', '', 'https://main.d1111222233334.amplifyapp.com', 12345, false]) {
      expect(() => parseDeployConfig(JSON.stringify({ ...good, amplifyAppId: bad })), JSON.stringify(bad)).toThrow(/amplifyAppId must be null or the Amplify app ID/);
    }
  });

  it('refuses the "default" profile: a changed default must never redirect a deploy', () => {
    expect(() => parseDeployConfig(JSON.stringify({ ...good, awsProfile: 'default' }))).toThrow(/default/);
  });

  it('lists every problem at once, including unknown keys', () => {
    const message = (() => {
      try {
        parseDeployConfig(JSON.stringify({ awsProfile: '', awsAccountId: 12345, region: 'nowhere', extra: true }));
      } catch (error) {
        return (error as Error).message;
      }
      return '';
    })();
    expect(message).toMatch(/unknown key "extra"/);
    expect(message).toMatch(/awsProfile/);
    expect(message).toMatch(/12-digit/);
    expect(message).toMatch(/region/);
  });

  it('refuses when the profile reaches a different account, and says which', () => {
    expect(accountMismatch(good, { account: '111122223333', arn: 'arn:aws:iam::111122223333:user/dev' })).toBeNull();
    const refusal = accountMismatch(good, { account: '444455556666', arn: 'arn:aws:iam::444455556666:user/other' });
    expect(refusal).toMatch(/444455556666/);
    expect(refusal).toMatch(/Refusing/);
  });

  it('reads the STS answer strictly', () => {
    expect(parseCallerIdentity(JSON.stringify({ Account: '111122223333', Arn: 'arn:aws:iam::111122223333:user/dev', UserId: 'X' }))).toEqual({
      account: '111122223333',
      arn: 'arn:aws:iam::111122223333:user/dev',
    });
    expect(() => parseCallerIdentity('{}')).toThrow(/no account/);
    expect(() => parseCallerIdentity('not json')).toThrow();
  });

  it('runs only local binaries, always with the checked profile (and account when asked)', () => {
    expect(execPlan(good, ['ampx', 'sandbox'])).toEqual({ file: 'npx', args: ['--no-install', 'ampx', 'sandbox', '--profile', 'personal'] });
    expect(execPlan(good, ['auth-kit', 'seed-personas', '--dry-run'], { passAccount: true }).args).toEqual([
      '--no-install', 'auth-kit', 'seed-personas', '--dry-run', '--profile', 'personal', '--account', '111122223333',
    ]);
  });

  it('won’t let a caller pass a different profile or account past the check', () => {
    expect(() => execPlan(good, ['ampx', 'sandbox', '--profile', 'other'])).toThrow(/--profile/);
    expect(() => execPlan(good, ['auth-kit', 'seed-personas', '--account=444455556666'])).toThrow(/--account/);
    expect(() => execPlan(good, [])).toThrow(/needs a command/);
  });
});
