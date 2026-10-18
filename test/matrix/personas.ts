/**
 * The auth matrix's test people, in auth-kit's `MatrixPersonaSpec` shape: the groups in each one's
 * token, plus how the scripted Cognito (auth-kit's matrix server mode) describes them. The first
 * seven mirror personas.json (one per site-wide role, auth-kit ADR 0020, and two members); the last
 * four are the lifecycle cases the standard cares about. With `anonymous`, that's 12.
 *
 * `admin` is the name auth-kit's matrix requires for "an admin"; here it's Admin – content & people.
 */
import type { MatrixPersonaSpec } from 'auth-kit/testing';

export interface SiteMatrixPersona extends MatrixPersonaSpec {
  /** Why this persona exists. */
  why: string;
}

export const MATRIX_PERSONAS = {
  member: { groups: [], why: 'Signed in with no group: Contributor on project A (the matrix seeds it), so sees and edits it, and can’t share it.' },
  otherMember: { groups: [], why: 'A second member with no role on project A: must get 404 for it.' },
  adminView: { groups: ['admin-view'], why: 'Admin – view only: sees the admin area and every project, changes nothing.' },
  adminContent: { groups: ['admin-content'], why: 'Admin – content only: edits every project, no people, can’t share a project.' },
  admin: { groups: ['admin-content-people'], why: 'Admin – content & people: people below their own role; creates project A and is its Manager.' },
  superadmin: { groups: ['superadmin'], why: 'Super admin: everything but owner-only.' },
  owner: { groups: ['owner'], why: 'The owner: everything.' },
  noAuthenticator: {
    groups: [],
    factors: { configured: ['PASSWORD'], mfa: [] },
    why: 'A password user without an authenticator: only the setup page lets them in.',
  },
  demotedAdmin: {
    groups: ['admin-content-people'],
    liveGroups: [],
    why: 'Token still says admin, Cognito says member: admin pages (checked live) refuse at once.',
  },
  disabledAdmin: {
    groups: ['admin-content-people'],
    enabled: false,
    why: 'Disabled after the token was issued: Cognito refuses the token’s factor check, so every check fails.',
  },
  revokedSession: {
    groups: ['admin-content'],
    sessionRevoked: true,
    why: 'Signed out everywhere: Cognito refuses the session, so its token stops working.',
  },
} as const satisfies Record<string, SiteMatrixPersona>;

export type MatrixPersonaKey = keyof typeof MATRIX_PERSONAS;
export type MatrixPersonaName = MatrixPersonaKey | 'anonymous';

/** The specs `startMatrixServer` takes (the same personas, without `why`). */
export function matrixPersonaSpecs(): Record<MatrixPersonaKey, MatrixPersonaSpec> {
  const specs = {} as Record<MatrixPersonaKey, MatrixPersonaSpec>;
  for (const [name, persona] of Object.entries(MATRIX_PERSONAS) as [MatrixPersonaKey, SiteMatrixPersona][]) {
    const spec: MatrixPersonaSpec & { why?: string } = { ...persona };
    delete spec.why;
    specs[name] = spec;
  }
  return specs;
}

/**
 * What the globalSetup hands the tests. Plain data only: it crosses a process boundary, so the
 * server's functions (stop, log, the issuer) stay in the setup.
 */
export interface MatrixContext {
  baseUrl: string;
  clientId: string;
  personas: Record<MatrixPersonaKey, { username: string; sub: string; email: string; accessToken: string; idToken: string; cookie: string }>;
}

declare module 'vitest' {
  export interface ProvidedContext {
    matrix: MatrixContext;
  }
}
