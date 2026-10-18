/**
 * The auth matrix's test people, in auth-kit's `MatrixPersonaSpec` shape: the groups in each one's
 * token, plus how the scripted Cognito (auth-kit's matrix server mode) describes them.
 *
 * - One per site-wide role (auth-kit ADR 0020) and two members, as in personas.json.
 * - The resource roles on project A (ADR 0022), which the matrix seeds: `member` is its Contributor,
 *   `manager` its Manager, `reader` its Reader (personas.json's sample Manager, Contributor, Reader).
 * - The lifecycle cases the standard cares about: a password user without an authenticator, a demoted
 *   admin, a disabled admin, a signed-out-everywhere session, and an account with only emailed codes
 *   (`codeOnlyMember`, auth-kit's `EMAILED_CODE_ONLY_MEMBER`: an invitee who closed the tab before
 *   choosing a passkey or a password, refused everywhere but the chooser page; ADR 0024).
 * - On sign-up sites only, a freshly signed-up Member (`newMember`, auth-kit's `FRESH_SIGN_UP_MEMBER`):
 *   it must never get further than a member (ADR 0023).
 *
 * `admin` is the name auth-kit's matrix requires for "an admin"; here it's Admin – content & people.
 */
import { EMAILED_CODE_ONLY_MEMBER, FRESH_SIGN_UP_MEMBER, type MatrixPersonaSpec } from 'auth-kit/testing';
import { takesSignUps } from '@/lib/account-modes';
import { site } from '@/site.config';

export interface SiteMatrixPersona extends MatrixPersonaSpec {
  /** Why this persona exists. */
  why: string;
}

const BASE_PERSONAS = {
  member: { groups: [], why: 'Signed in with no group: Contributor on project A (the matrix seeds it), so sees and edits it, and can’t share it.' },
  otherMember: { groups: [], why: 'A second member with no role on project A: must get 404 for it.' },
  manager: { groups: [], why: 'A member who is Manager of project A: sees and edits it and chooses who has access; no site role.' },
  reader: { groups: [], why: 'A member who is Reader on project A: sees it; editing or sharing it is 403, not 404.' },
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
  codeOnlyMember: {
    ...EMAILED_CODE_ONLY_MEMBER,
    why: 'Only emailed codes so far (an invitee who closed the tab at “Choose how you’ll sign in”): refused everywhere but the chooser page.',
  },
} as const satisfies Record<string, SiteMatrixPersona>;

/** A sign-up site's freshly signed-up Member: held to a member's answers on every row. */
const SIGN_UP_PERSONAS = {
  newMember: { ...FRESH_SIGN_UP_MEMBER, why: 'Signed up a moment ago and chose a passkey: no role, no item access. Never more than a member.' },
} as const satisfies Record<string, SiteMatrixPersona>;

/** Whether this site takes sign-ups (site.config.ts `accountCreation`): then the matrix runs `newMember` too. */
export const SIGN_UP_SITE = takesSignUps(site.accountCreation);

export type MatrixPersonaKey = keyof typeof BASE_PERSONAS | keyof typeof SIGN_UP_PERSONAS;
export type MatrixPersonaName = MatrixPersonaKey | 'anonymous';

/** The personas this site's matrix runs. */
export const MATRIX_PERSONAS: Partial<Record<MatrixPersonaKey, SiteMatrixPersona>> = { ...BASE_PERSONAS, ...(SIGN_UP_SITE ? SIGN_UP_PERSONAS : {}) };

/** The specs `startMatrixServer` takes (the same personas, without `why`). */
export function matrixPersonaSpecs(): Partial<Record<MatrixPersonaKey, MatrixPersonaSpec>> {
  const specs: Partial<Record<MatrixPersonaKey, MatrixPersonaSpec>> = {};
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
  personas: Partial<Record<MatrixPersonaKey, { username: string; sub: string; email: string; accessToken: string; idToken: string; cookie: string }>>;
}

declare module 'vitest' {
  export interface ProvidedContext {
    matrix: MatrixContext;
  }
}
