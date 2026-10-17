/**
 * The dev-only matrix module (lib/dev/matrix.on.ts) must stay inert unless the matrix asked for it,
 * and its scripted Cognito must answer the way Cognito does. Imported by path: the `@/dev-matrix`
 * alias always means the "off" module in tests, as in builds.
 */
import { createTestIssuer } from 'auth-kit/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MATRIX_FIXTURE_ENV } from '@/lib/dev/matrix-types';

async function load() {
  vi.resetModules();
  return import('@/lib/dev/matrix.on');
}

afterEach(() => vi.unstubAllEnvs());

describe('lib/dev/matrix.on.ts', () => {
  it('does nothing outside next dev, even with the flag', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_KIT_MATRIX', '1');
    expect((await load()).matrixOverrides()).toBeNull();
  });

  it('does nothing under next dev without AUTH_KIT_MATRIX=1', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AUTH_KIT_MATRIX', '');
    expect((await load()).matrixOverrides()).toBeNull();
  });

  it('refuses to guess when the flag is set but no fixture is', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AUTH_KIT_MATRIX', '1');
    vi.stubEnv(MATRIX_FIXTURE_ENV, '');
    await expect(load().then((m) => m.matrixOverrides())).rejects.toThrow(/needs SITE_MATRIX_FIXTURE/);
  });

  it('answers like Cognito: disabled → account_disabled, revoked → invalid_token, demoted → live groups', async () => {
    const issuer = createTestIssuer({ userPoolId: 'us-east-1_PlaceholderPool', clientId: 'placeholderappclient00000' });
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AUTH_KIT_MATRIX', '1');
    vi.stubEnv(
      MATRIX_FIXTURE_ENV,
      JSON.stringify({
        jwks: issuer.jwks,
        users: [
          { username: 'ok', sub: 'ok', email: 'ok@matrix.test', groups: ['editor'] },
          { username: 'off', sub: 'off', email: 'off@matrix.test', groups: ['admin'], enabled: false },
          { username: 'out', sub: 'out', email: 'out@matrix.test', groups: [], sessionRevoked: true },
          { username: 'down', sub: 'down', email: 'down@matrix.test', groups: ['admin'], liveGroups: [] },
        ],
      }),
    );
    const overrides = (await load()).matrixOverrides();
    const gateway = overrides?.serverAuth.cognito;
    expect(gateway).toBeDefined();
    await expect(gateway!.getUserAuthFactors({ accessToken: 'x', username: 'ok' })).resolves.toEqual({ configured: ['PASSWORD'], mfa: ['SOFTWARE_TOKEN_MFA'] });
    await expect(gateway!.getUserAuthFactors({ accessToken: 'x', username: 'off' })).rejects.toMatchObject({ code: 'account_disabled' });
    await expect(gateway!.getUserAuthFactors({ accessToken: 'x', username: 'out' })).rejects.toMatchObject({ code: 'invalid_token' });
    await expect(gateway!.getLiveUserState('down')).resolves.toMatchObject({ enabled: true, groups: [] });
    await expect(gateway!.getUserAuthFactors({ accessToken: 'x', username: 'stranger' })).rejects.toThrow(/no test person/);
  });

  it('changes no accounts and sends no email', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AUTH_KIT_MATRIX', '1');
    const issuer = createTestIssuer({ userPoolId: 'us-east-1_PlaceholderPool', clientId: 'placeholderappclient00000' });
    vi.stubEnv(MATRIX_FIXTURE_ENV, JSON.stringify({ jwks: issuer.jwks, users: [] }));
    const overrides = (await load()).matrixOverrides()!;
    class AdminDisableUserCommand {
      input = { Username: 'x' };
    }
    await expect((overrides.peopleCognito as unknown as { send: (c: unknown) => Promise<unknown> }).send(new AdminDisableUserCommand())).rejects.toThrow(/changes no accounts/);
    await expect(overrides.mailer.sendInvite({} as never)).rejects.toThrow(/sends no email/);
  });
});
