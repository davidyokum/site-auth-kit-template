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
import { type CognitoGateway, type LiveUserState, UnauthenticatedError, type UserAuthFactors } from 'auth-kit/server';
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

/**
 * Answers the way Cognito does: `GetUserAuthFactors` with the person's own token is refused for a
 * disabled account or a revoked session (auth-kit maps those to 401 `account_disabled` and
 * `invalid_token`), and `AdminGetUser` reports the live status and groups.
 */
function scriptedGateway(users: ReadonlyMap<string, MatrixFixtureUser>): CognitoGateway {
  const find = (username: string) => {
    const user = users.get(username);
    if (!user) throw new Error(`matrix: no test person "${username}" in the fixture`);
    return user;
  };
  return {
    async getUserAuthFactors({ username }): Promise<UserAuthFactors> {
      const user = find(username);
      if (user.enabled === false) throw new UnauthenticatedError('account_disabled', 'This account is disabled.');
      if (user.sessionRevoked === true) throw new UnauthenticatedError('invalid_token', 'Your session has ended. Sign in again.');
      return user.factors ?? SEEDED_FACTORS;
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

type SharedData = Pick<MatrixOverrides, 'auditLog' | 'tickets'>;

/**
 * The in-memory data, one copy per server process. The proxy, pages, and route handlers are
 * bundled separately and each evaluates this module, but a ticket filed through the API must show
 * on the page, so the stores live on globalThis.
 */
function sharedData(): SharedData {
  const holder = globalThis as { [GLOBAL_KEY]?: SharedData };
  return (holder[GLOBAL_KEY] ??= { auditLog: createMemoryAuditLog(), tickets: createMemoryTicketStore() });
}

let local: MatrixOverrides | undefined;

/**
 * Everything else is built per bundle. It must be: auth-kit checks errors with `instanceof`, and
 * each bundle has its own copy of auth-kit, so a gateway shared from the proxy's bundle would throw
 * an UnauthenticatedError the page's copy doesn't recognize (a 500 instead of a 401).
 */
function build(fixture: MatrixFixture): MatrixOverrides {
  const byUsername = new Map(fixture.users.map((u) => [u.username, u]));
  const refuseEmail = async () => {
    throw new Error('matrix: the auth-matrix server sends no email');
  };
  return {
    serverAuth: { jwks: fixture.jwks, cognito: scriptedGateway(byUsername) },
    peopleCognito: scriptedPeopleClient(fixture.users),
    mailer: { sendInvite: refuseEmail, ownerGranted: refuseEmail },
    ...sharedData(),
    marker: DEV_SIGNIN_MARKER,
  };
}

export function matrixOverrides(): MatrixOverrides | null {
  if (process.env.NODE_ENV !== 'development' || process.env.AUTH_KIT_MATRIX !== '1') return null;
  return (local ??= build(readFixture()));
}
