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
  member: { groups: [], why: 'Signed in with no group: owns their own tickets, nothing else.' },
  otherMember: { groups: [], why: 'A second member: must get 404 for the first member’s items.' },
  adminView: { groups: ['admin-view'], why: 'Admin – view only: sees the admin area, changes nothing; no one else’s tickets.' },
  adminContent: { groups: ['admin-content'], why: 'Admin – content only: any content, no people, no one else’s tickets.' },
  admin: { groups: ['admin-content-people'], why: 'Admin – content & people: people below their own role, and tickets.read-all.' },
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
  personas: Record<MatrixPersonaKey, { username: string; sub: string; accessToken: string; idToken: string; cookie: string }>;
}

declare module 'vitest' {
  export interface ProvidedContext {
    matrix: MatrixContext;
  }
}
