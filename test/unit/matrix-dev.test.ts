/**
 * The matrix wiring: `@/dev-matrix` is auth-kit's matrix server mode under `next dev`
 * (lib/dev/matrix.on.ts) and null in every build (matrix.off.ts). The server mode must stay inert
 * unless the matrix asked for it, and with this site's own personas it must answer the way Cognito
 * does. Imported by path: the `@/dev-matrix` alias always means the "off" module in tests, as in builds.
 *
 * auth-kit memoizes the overrides per module, and Node caches auth-kit itself, so the overrides
 * are built once, in the last test, after the checks that must see nothing built.
 */
import { createTestIssuer, MATRIX_ENV_FLAG, MATRIX_FIXTURE_ENV, matrixFixture, parseMatrixFixture } from 'auth-kit/testing';
import { matrixServerOverrides } from 'auth-kit/testing/matrix-server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as off from '@/lib/dev/matrix.off';
import * as on from '@/lib/dev/matrix.on';
import type { MatrixPersonaSpec } from 'auth-kit/testing';
import { MATRIX_PERSONAS, type MatrixPersonaKey, SIGN_UP_SITE, matrixPersonaSpecs } from '../matrix/personas';

/** This site's personas (every key present is a full spec). */
const specs = () => matrixPersonaSpecs() as Record<MatrixPersonaKey, MatrixPersonaSpec>;

const issuer = () => createTestIssuer({ userPoolId: 'us-east-1_PlaceholderPool', clientId: 'placeholderappclient00000' });

afterEach(() => vi.unstubAllEnvs());

describe('@/dev-matrix', () => {
  it('is auth-kit’s matrix server mode under next dev, and null in every build', () => {
    expect(on.matrixOverrides).toBe(matrixServerOverrides);
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv(MATRIX_ENV_FLAG, '1');
    expect(off.matrixOverrides()).toBeNull();
  });

  it('does nothing outside next dev, even with the flag', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv(MATRIX_ENV_FLAG, '1');
    expect(on.matrixOverrides()).toBeNull();
  });

  it('does nothing under next dev without AUTH_KIT_MATRIX=1', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv(MATRIX_ENV_FLAG, '');
    expect(on.matrixOverrides()).toBeNull();
  });

  it('refuses to guess when the flag is set but no fixture is', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv(MATRIX_ENV_FLAG, '1');
    vi.stubEnv(MATRIX_FIXTURE_ENV, '');
    expect(() => on.matrixOverrides()).toThrow(new RegExp(`needs ${MATRIX_FIXTURE_ENV}`));
  });

  it('describes every persona (anonymous plus these fourteen, and newMember on sign-up sites) in a fixture auth-kit accepts', () => {
    const { fixture, personas } = matrixFixture({ issuer: issuer(), personas: specs() });
    expect(Object.keys(personas).sort()).toEqual(Object.keys(MATRIX_PERSONAS).sort());
    expect(Object.keys(personas).length + 1).toBe(SIGN_UP_SITE ? 16 : 15);
    // The parser refuses unknown fields, so `why` (documentation) never reaches the fixture.
    expect(parseMatrixFixture(JSON.stringify(fixture))).toEqual(fixture);
    for (const user of fixture.users) expect(user).not.toHaveProperty('why');
  });

  it('answers like Cognito for the lifecycle personas, changes no accounts, and sends no email', async () => {
    const { fixture, personas } = matrixFixture({ issuer: issuer(), personas: specs() });
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv(MATRIX_ENV_FLAG, '1');
    vi.stubEnv(MATRIX_FIXTURE_ENV, JSON.stringify(fixture));
    const overrides = on.matrixOverrides();
    if (!overrides) throw new Error('expected the matrix overrides');
    const gateway = overrides.serverAuth.cognito;
    const factors = (name: keyof typeof personas) => gateway.getUserAuthFactors({ accessToken: 'x', username: personas[name].username });

    await expect(factors('member')).resolves.toEqual({ configured: ['PASSWORD'], mfa: ['SOFTWARE_TOKEN_MFA'] });
    await expect(factors('noAuthenticator')).resolves.toEqual({ configured: ['PASSWORD'], mfa: [] });
    // Only emailed codes so far: the server sends it to the chooser page (first credential required).
    await expect(factors('codeOnlyMember')).resolves.toEqual({ configured: ['EMAIL_OTP'], mfa: [] });
    await expect(factors('disabledAdmin')).rejects.toMatchObject({ code: 'account_disabled' });
    await expect(factors('revokedSession')).rejects.toMatchObject({ code: 'invalid_token' });
    await expect(gateway.getLiveUserState(personas.demotedAdmin.username)).resolves.toMatchObject({ enabled: true, groups: [] });
    await expect(gateway.getUserAuthFactors({ accessToken: 'x', username: 'stranger' })).rejects.toThrow(/no person "stranger"/);

    class AdminDisableUserCommand {
      input = { Username: personas.member.username };
    }
    await expect((overrides.peopleCognito as unknown as { send: (c: unknown) => Promise<unknown> }).send(new AdminDisableUserCommand())).rejects.toThrow(
      /changes no accounts/,
    );
    await expect(overrides.mailer.sendInvite({} as never)).rejects.toThrow(/sends no email/);

    // The app's own stores: one per server process and key (lib/projects/index.ts uses 'projects').
    const projects = overrides.shared('projects', () => ({ rows: [] as string[] }));
    expect(overrides.shared('projects', () => ({ rows: ['another'] }))).toBe(projects);
    // Resource roles: one membership store per process, which lib/resources.ts uses under the matrix.
    expect(typeof overrides.resources.getMembership).toBe('function');
    expect(overrides.marker).toEqual(expect.any(String));
  });
});
