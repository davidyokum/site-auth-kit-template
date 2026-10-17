/**
 * The auth matrix's test people. Each one is a token signed by the test issuer plus how the
 * scripted Cognito describes them (lib/dev/matrix.on.ts). The first seven mirror personas.json;
 * the last four are the lifecycle cases the standard cares about.
 */
import type { MatrixFixtureUser } from '@/lib/dev/matrix-types';

export interface MatrixPersonaSpec {
  /** Groups in the access token. */
  groups: string[];
  /** Everything else the scripted Cognito should say about them. */
  cognito?: Pick<MatrixFixtureUser, 'liveGroups' | 'enabled' | 'sessionRevoked' | 'factors'>;
  /** Why this persona exists. */
  why: string;
}

export const MATRIX_PERSONAS = {
  member: { groups: [], why: 'Signed in with no group: owns their own tickets, nothing else.' },
  otherMember: { groups: [], why: 'A second member: must get 404 for the first member’s records.' },
  viewer: { groups: ['viewer'], why: 'Lowest admin role: content.read only.' },
  editor: { groups: ['editor'], why: 'Content only; no people, no other people’s tickets.' },
  admin: { groups: ['admin'], why: 'People and tickets.read-all.' },
  owner: { groups: ['superadmin'], why: 'Everything (superadmin, shown as Owner).' },
  noAuthenticator: {
    groups: [],
    cognito: { factors: { configured: ['PASSWORD'], mfa: [] } },
    why: 'A password user without an authenticator: only the setup page lets them in.',
  },
  demotedAdmin: {
    groups: ['admin'],
    cognito: { liveGroups: [] },
    why: 'Token still says admin, Cognito says member: admin pages (checked live) refuse at once.',
  },
  disabledAdmin: {
    groups: ['admin'],
    cognito: { enabled: false },
    why: 'Disabled after the token was issued: Cognito refuses the token’s factor check, so every check fails.',
  },
  revokedSession: {
    groups: ['editor'],
    cognito: { sessionRevoked: true },
    why: 'Signed out everywhere: Cognito refuses the session, so its token stops working.',
  },
} as const satisfies Record<string, MatrixPersonaSpec>;

export type MatrixPersonaName = keyof typeof MATRIX_PERSONAS | 'anonymous';

/** What the globalSetup hands the tests (strings only: it crosses a process boundary). */
export interface MatrixContext {
  baseUrl: string;
  clientId: string;
  personas: Record<keyof typeof MATRIX_PERSONAS, { username: string; sub: string; accessToken: string; idToken: string }>;
}

declare module 'vitest' {
  export interface ProvidedContext {
    matrix: MatrixContext;
  }
}
