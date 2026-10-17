/**
 * Types shared by the auth-matrix fixture (test/matrix) and the dev-only module that reads it
 * (lib/dev/matrix.on.ts). Types only: nothing here runs.
 */
import type { AuditLogStore, InviteMailer, OwnerAlertNotifier, PeopleAdminConfig } from 'auth-kit/admin';
import type { CognitoGateway, JwksLike } from 'auth-kit/server';
import type { TicketStore } from '@/lib/tickets/types';

/** The environment variable the matrix test passes its fixture in (JSON). */
export const MATRIX_FIXTURE_ENV = 'SITE_MATRIX_FIXTURE';

/** One test person, as the matrix's scripted Cognito describes them. */
export interface MatrixFixtureUser {
  username: string;
  sub: string;
  email: string;
  /** Groups in their access token. */
  groups: string[];
  /** Groups Cognito reports now, when they differ from the token (a demoted admin). */
  liveGroups?: string[];
  /** False for an account disabled after its token was issued. Default true. */
  enabled?: boolean;
  /** Their sign-in factors. Default: a password and an authenticator (what seeded personas have). */
  factors?: { configured: string[]; mfa: string[] };
}

export interface MatrixFixture {
  /** The test issuer's public keys: tokens it signs verify; real Cognito tokens don't. */
  jwks: JwksLike;
  users: MatrixFixtureUser[];
}

/** What the app swaps in under the matrix dev server. */
export interface MatrixOverrides {
  serverAuth: { jwks: JwksLike; cognito: CognitoGateway };
  peopleCognito: NonNullable<PeopleAdminConfig['cognito']>;
  mailer: InviteMailer & OwnerAlertNotifier;
  auditLog: AuditLogStore;
  tickets: TicketStore;
  /** auth-kit's dev marker, so `auth-kit check-prod-build` fails if this module ever reaches a build. */
  marker: string;
}
