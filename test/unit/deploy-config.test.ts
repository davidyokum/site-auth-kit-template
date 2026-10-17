import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { accountMismatch, execPlan, parseCallerIdentity, parseDeployConfig, PLACEHOLDER_ACCOUNT_ID } from '../../scripts/lib/deploy-config.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const good = { awsProfile: 'personal', awsAccountId: '111122223333', region: 'us-east-1' };

describe('the account-assert preflight (scripts/preflight.mjs)', () => {
  it('refuses the template as shipped: the placeholder account must be replaced first', () => {
    expect(() => parseDeployConfig(readFileSync(join(ROOT, 'deploy.config.json'), 'utf8'))).toThrow(/placeholder/);
    expect(PLACEHOLDER_ACCOUNT_ID).toBe('000000000000');
  });

  it('accepts a complete config', () => {
    expect(parseDeployConfig(JSON.stringify(good))).toEqual(good);
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
