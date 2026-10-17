/**
 * DEV ONLY: what `@/dev-matrix` means under `next dev`. Never imported by a build (the alias points
 * at matrix.off.ts there, and it carries auth-kit's dev marker so `auth-kit check-prod-build` fails
 * if it ever leaks).
 *
 * The auth-matrix tests (test/matrix) run the real app under `next dev` with no AWS at all. With
 * AUTH_KIT_MATRIX=1 and a fixture in SITE_MATRIX_FIXTURE, the server:
 * - verifies tokens against the test issuer's public keys instead of the pool's (so tokens the
 *   test mints verify, and nothing else does: signature, expiry, issuer, client, token use all
 *   still checked);
 * - asks a scripted Cognito for each test person's factors, status, and groups;
 * - keeps tickets and the audit log in memory, and refuses to send email or change accounts.
 *
 * Without both variables it returns null and the app talks to AWS as usual (your sandbox).
 * AUTH_KIT_MATRIX=1 also lets auth-kit's proxy step aside for the matrix's "without proxy" pass,
 * only outside production builds and only on a loopback URL (auth-kit ADR 0014).
 */
import { createMemoryAuditLog } from 'auth-kit/admin';
import { DEV_SIGNIN_MARKER } from 'auth-kit/dev';
import type { CognitoGateway, LiveUserState, UserAuthFactors } from 'auth-kit/server';
import { createMemoryTicketStore } from '@/lib/tickets/memory';
import { MATRIX_FIXTURE_ENV, type MatrixFixture, type MatrixFixtureUser, type MatrixOverrides } from './matrix-types';

const GLOBAL_KEY = Symbol.for('site-auth-kit-template.matrix-overrides');
const SEEDED_FACTORS: UserAuthFactors = { configured: ['PASSWORD'], mfa: ['SOFTWARE_TOKEN_MFA'] };

function readFixture(): MatrixFixture {
  const raw = process.env[MATRIX_FIXTURE_ENV];
  if (!raw) throw new Error(`AUTH_KIT_MATRIX=1 needs ${MATRIX_FIXTURE_ENV} (the matrix test sets it). Refusing to guess.`);
  const fixture = JSON.parse(raw) as MatrixFixture;
  if (!Array.isArray(fixture?.jwks?.keys) || fixture.jwks.keys.length === 0 || !Array.isArray(fixture.users)) {
    throw new Error(`${MATRIX_FIXTURE_ENV} isn't a matrix fixture ({ jwks, users }).`);
  }
  return fixture;
}

function scriptedGateway(users: ReadonlyMap<string, MatrixFixtureUser>): CognitoGateway {
  const find = (username: string) => {
    const user = users.get(username);
    if (!user) throw new Error(`matrix: no test person "${username}" in the fixture`);
    return user;
  };
  return {
    async getUserAuthFactors({ username }): Promise<UserAuthFactors> {
      return find(username).factors ?? SEEDED_FACTORS;
    },
    async getLiveUserState(username): Promise<LiveUserState> {
      const user = find(username);
      return { enabled: user.enabled !== false, status: 'CONFIRMED', groups: user.liveGroups ?? user.groups };
    },
  };
}

/** A read-only stand-in for the Cognito admin client: lists the test people, refuses every change. */
function scriptedPeopleClient(users: readonly MatrixFixtureUser[]): MatrixOverrides['peopleCognito'] {
  const created = new Date('2026-01-01T00:00:00Z');
  const toUserType = (u: MatrixFixtureUser) => ({
    Username: u.username,
    Attributes: [
      { Name: 'sub', Value: u.sub },
      { Name: 'email', Value: u.email },
      { Name: 'email_verified', Value: 'true' },
    ],
    Enabled: u.enabled !== false,
    UserStatus: 'CONFIRMED',
    UserCreateDate: created,
    UserLastModifiedDate: created,
  });
  const groupsOf = (u: MatrixFixtureUser) => u.liveGroups ?? u.groups;
  const client = {
    async send(command: { constructor: { name: string }; input: Record<string, unknown> }) {
      const input = command.input;
      switch (command.constructor.name) {
        case 'ListUsersCommand': {
          const filter = typeof input.Filter === 'string' ? /^(sub|email) = "(.*)"$/.exec(input.Filter) : null;
          const list = filter ? users.filter((u) => (filter[1] === 'sub' ? u.sub : u.email) === filter[2]) : users;
          return { Users: list.map(toUserType) };
        }
        case 'ListUsersInGroupCommand':
          return { Users: users.filter((u) => groupsOf(u).includes(String(input.GroupName))).map(toUserType) };
        case 'AdminListGroupsForUserCommand': {
          const user = users.find((u) => u.username === input.Username);
          return { Groups: (user ? groupsOf(user) : []).map((GroupName) => ({ GroupName })) };
        }
        default:
          throw new Error(`matrix: the auth-matrix server changes no accounts (${command.constructor.name} refused)`);
      }
    },
  };
  return client as unknown as MatrixOverrides['peopleCognito'];
}

function build(fixture: MatrixFixture): MatrixOverrides {
  const byUsername = new Map(fixture.users.map((u) => [u.username, u]));
  const refuseEmail = async () => {
    throw new Error('matrix: the auth-matrix server sends no email');
  };
  return {
    serverAuth: { jwks: fixture.jwks, cognito: scriptedGateway(byUsername) },
    peopleCognito: scriptedPeopleClient(fixture.users),
    mailer: { sendInvite: refuseEmail, ownerGranted: refuseEmail },
    auditLog: createMemoryAuditLog(),
    tickets: createMemoryTicketStore(),
    marker: DEV_SIGNIN_MARKER,
  };
}

export function matrixOverrides(): MatrixOverrides | null {
  if (process.env.NODE_ENV !== 'development' || process.env.AUTH_KIT_MATRIX !== '1') return null;
  // One set per server process: the proxy, pages, and route handlers are bundled separately and each
  // evaluates this module, but they must share the same in-memory tickets and audit log.
  const store = globalThis as { [GLOBAL_KEY]?: MatrixOverrides };
  return (store[GLOBAL_KEY] ??= build(readFixture()));
}
