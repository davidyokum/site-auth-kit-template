/**
 * The build's check that a Full site isn't turned Simple (auth-kit ADR 0029): decided from the setting
 * and the deployed backend's outputs, with no AWS call here.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isNoBackendYet, signInModeGuard } from '@/scripts/lib/sign-in-mode-guard.mjs';

const SIMPLE = { mode: 'simple', stay: 30 };
const outputs = (mfa: string) => ({ outputs: { auth: { mfa_configuration: mfa } } });

describe('the build refuses to turn a Full site Simple (auth-kit ADR 0029)', () => {
  it('lets a Full site through whatever is deployed: Simple to Full is a settings change and a deploy', () => {
    for (const deployed of [outputs('NONE'), outputs('OPTIONAL'), { error: 'denied' }, { noBackendYet: true }]) {
      expect(signInModeGuard({ mode: 'full' }, deployed).ok).toBe(true);
      expect(signInModeGuard(undefined, deployed).ok).toBe(true);
    }
  });

  it('lets a Simple site deploy over a Simple pool, or as a new backend', () => {
    expect(signInModeGuard(SIMPLE, outputs('NONE')).ok).toBe(true);
    expect(signInModeGuard(SIMPLE, { noBackendYet: true }).ok).toBe(true);
  });

  it('stops a Simple setting over a Full pool, and fails closed when it can’t tell', () => {
    const refused = signInModeGuard(SIMPLE, outputs('OPTIONAL'));
    expect(refused.ok).toBe(false);
    expect(refused.message).toMatch(/A Full site can't become Simple: anyone with an authenticator app would be locked out/);
    expect(signInModeGuard(SIMPLE, outputs('REQUIRED')).ok).toBe(false);
    expect(signInModeGuard(SIMPLE, { error: 'AccessDeniedError' }).ok).toBe(false);
    expect(signInModeGuard(SIMPLE, { outputs: { auth: {} } }).ok).toBe(false);
  });

  it('knows a branch with no backend yet from ampx’s own error', () => {
    expect(isNoBackendYet('[StackDoesNotExistError] Stack does not exist.')).toBe(true);
    expect(isNoBackendYet('[AccessDeniedError] Unable to get backend outputs')).toBe(false);
  });

  it('runs in the build before the backend deploys', () => {
    const spec = readFileSync(join(import.meta.dirname, '..', '..', 'amplify.yml'), 'utf8');
    expect(spec.indexOf('node scripts/check-sign-in-mode.mjs')).toBeGreaterThan(-1);
    expect(spec.indexOf('node scripts/check-sign-in-mode.mjs')).toBeLessThan(spec.indexOf('npx ampx pipeline-deploy'));
  });
});
