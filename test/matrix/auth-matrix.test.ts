/**
 * The auth matrix (03 §2 Assurance; auth-kit/testing): every route the build serves, as every
 * persona, twice: once through the proxy and once with the proxy stepped aside, so a route that
 * leans on the proxy for its 401 fails (auth-kit ADR 0014). A route with no row fails, and so does
 * a row for a route that doesn't exist.
 *
 * Run: `npm run build && npm run test:matrix` (the matrix reads the build's route manifest, then
 * starts its own `next dev`; see global-setup.ts). Server actions aren't in the manifest; they're
 * covered by test/unit/actions.test.ts.
 *
 * When you add a page or route: add a row here. When you add a role: add a persona in personas.ts
 * and its expectation on every row.
 */
import { type MatrixRoute, type PersonaDefinition, assertAuthMatrix, routesFromNextBuild, tamperToken } from 'auth-kit/testing';
import { join } from 'node:path';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { MATRIX_PERSONAS, type MatrixPersonaKey, type MatrixPersonaName } from './personas';

const ROOT = join(import.meta.dirname, '..', '..');
// From global-setup.ts (auth-kit's startMatrixServer): each persona's Amplify session cookies and tokens.
const { baseUrl, personas } = inject('matrix');

type Expect = Record<MatrixPersonaName, number>;
const persona = (name: MatrixPersonaKey): PersonaDefinition => ({ headers: { cookie: personas[name].cookie } });
const send = (path: string, init: RequestInit & { as?: MatrixPersonaKey } = {}) => {
  const headers = new Headers(init.headers);
  if (init.as) headers.set('cookie', personas[init.as].cookie);
  return fetch(new URL(path, baseUrl), { ...init, headers, redirect: 'manual' });
};

// ---- Expectations, by kind of route ------------------------------------------------------------
// 307: a page sends someone without a usable session to /sign-in?next=… (and a password user
// without an authenticator to /account/authenticator). 404: not allowed, or not theirs: pages and
// record routes never confirm that something exists.

/** Public pages: everyone. */
const PUBLIC: Expect = {
  anonymous: 200, member: 200, otherMember: 200, viewer: 200, editor: 200, admin: 200, owner: 200,
  noAuthenticator: 200, demotedAdmin: 200, disabledAdmin: 200, revokedSession: 200,
};

/** Pages any signed-in person may open (requireUser). */
const SIGNED_IN_PAGE: Expect = {
  anonymous: 307, member: 200, otherMember: 200, viewer: 200, editor: 200, admin: 200, owner: 200,
  noAuthenticator: 307, // → /account/authenticator
  demotedAdmin: 200, // not an admin page: the token's groups apply until it's refreshed (≤ 60 min)
  disabledAdmin: 307, // Cognito refuses a disabled account's token at the factor check
  revokedSession: 307, // ...and a signed-out-everywhere session's
};

/**
 * The authenticator setup page lets in a password user without an authenticator. It skips the
 * factor check by design (that check is what sends people here), so it can't see a disabled
 * account or a revoked session either; it shows no data, and the browser's own Cognito calls are
 * refused for both.
 */
const AUTHENTICATOR_PAGE: Expect = {
  ...SIGNED_IN_PAGE,
  noAuthenticator: 200,
  disabledAdmin: 200,
  revokedSession: 200,
};

/** A ticket page for the member's own ticket (requireUser + requireRecordAccess). */
const OWN_RECORD_PAGE: Expect = {
  ...SIGNED_IN_PAGE,
  otherMember: 404, // the standard's second-member check: not theirs, so "not found"
  viewer: 404,
  editor: 404, // content roles don't cover tickets
  admin: 200, // tickets.read-all
  owner: 200,
  demotedAdmin: 200, // token still carries tickets.read-all until refresh; admin PAGES check live
};

/** Admin pages (requireCan('people.manage' | 'audit.read', { live: true })). */
const ADMIN_PAGE: Expect = {
  anonymous: 307, member: 404, otherMember: 404, viewer: 404, editor: 404, admin: 200, owner: 200,
  noAuthenticator: 307,
  demotedAdmin: 404, // live re-read: Cognito says member now, so the admin area refuses at once
  disabledAdmin: 307,
  revokedSession: 307,
};

/** API routes any signed-in person may call. */
const SIGNED_IN_API: Expect = {
  anonymous: 401, member: 200, otherMember: 200, viewer: 200, editor: 200, admin: 200, owner: 200,
  noAuthenticator: 403, // mfa_enrollment_required
  demotedAdmin: 200,
  disabledAdmin: 401, // account_disabled
  revokedSession: 401, // invalid_token
};

const CREATE_API: Expect = Object.fromEntries(Object.entries(SIGNED_IN_API).map(([k, v]) => [k, v === 200 ? 201 : v])) as Expect;

const OWN_RECORD_API: Expect = { ...SIGNED_IN_API, otherMember: 404, viewer: 404, editor: 404 };

// ---- The matrix -------------------------------------------------------------------------------

let memberTicketId = '';

beforeAll(async () => {
  // The member files a ticket through the app itself; record rows use its ID.
  const response = await send('/api/tickets', {
    as: 'member',
    method: 'POST',
    headers: { origin: baseUrl, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Member’s own ticket', body: 'Only the member and staff may read this.' }),
  });
  expect(response.status, await response.clone().text()).toBe(201);
  memberTicketId = ((await response.json()) as { ticket: { id: string } }).ticket.id;
});

describe('auth matrix', () => {
  it('every route answers every persona as the standard requires, with and without the proxy', async () => {
    const routes: MatrixRoute[] = [
      { path: '/', expect: PUBLIC },
      { path: '/sign-in', expect: PUBLIC },
      { path: '/account', expect: SIGNED_IN_PAGE },
      { path: '/account/authenticator', expect: AUTHENTICATOR_PAGE },
      { path: '/app', expect: SIGNED_IN_PAGE },
      { path: '/app/tickets/:id', expect: OWN_RECORD_PAGE },
      { path: '/admin', expect: ADMIN_PAGE },
      { path: '/admin/people', expect: ADMIN_PAGE },
      { path: '/admin/activity', expect: ADMIN_PAGE },
      { method: 'GET', path: '/api/tickets', expect: SIGNED_IN_API },
      {
        method: 'POST',
        path: '/api/tickets',
        headers: { origin: baseUrl },
        body: { title: 'Matrix ticket', body: 'Filed by the auth matrix.' },
        expect: CREATE_API,
      },
      { method: 'GET', path: '/api/tickets/:id', expect: OWN_RECORD_API },
    ];

    const results = await assertAuthMatrix({
      request: (request) => fetch(request, { redirect: 'manual' }),
      baseUrl,
      appRoutes: routesFromNextBuild(join(ROOT, '.next')),
      personas: {
        anonymous: {},
        ...Object.fromEntries((Object.keys(MATRIX_PERSONAS) as MatrixPersonaKey[]).map((name) => [name, persona(name)])),
      },
      params: { id: memberTicketId },
      routes,
    });
    // 12 routes × 11 personas × 2 passes.
    expect(results.length).toBe(routes.length * 11 * 2);
  });
});

describe('what the matrix rows can’t express', () => {
  it('redirects go to sign-in with a safe return path, or to authenticator setup', async () => {
    const anonymous = await send('/app');
    expect(anonymous.status).toBe(307);
    expect(anonymous.headers.get('location')).toMatch(/^\/sign-in\?next=%2Fapp$/);

    const noAuthenticator = await send('/app', { as: 'noAuthenticator' });
    expect(noAuthenticator.status).toBe(307);
    expect(noAuthenticator.headers.get('location')).toMatch(/\/account\/authenticator$/);
  });

  it('lists are filtered on the server: another member never sees the ticket; staff do', async () => {
    const ids = async (as: MatrixPersonaKey) => {
      const response = await send('/api/tickets', { as });
      expect(response.status).toBe(200);
      return ((await response.json()) as { tickets: { id: string }[] }).tickets.map((t) => t.id);
    };
    expect(await ids('member')).toContain(memberTicketId);
    expect(await ids('otherMember')).not.toContain(memberTicketId);
    expect(await ids('editor')).not.toContain(memberTicketId);
    expect(await ids('admin')).toContain(memberTicketId);
  });

  it('a state change from another origin is refused (403 origin_mismatch)', async () => {
    const response = await send('/api/tickets', {
      as: 'member',
      method: 'POST',
      headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Cross-site' }),
    });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { error: string }).error).toBe('origin_mismatch');

    // Only the configured origin counts (lib/origin.ts), not request.url's (next dev says localhost).
    const localhost = await send('/api/tickets', {
      as: 'member',
      method: 'POST',
      headers: { origin: baseUrl.replace('127.0.0.1', 'localhost'), 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Wrong origin' }),
    });
    expect(localhost.status).toBe(403);
  });

  it('input is validated on the server (415 for non-JSON, 400 for a bad title)', async () => {
    const form = await send('/api/tickets', { as: 'member', method: 'POST', headers: { origin: baseUrl, 'content-type': 'text/plain' }, body: 'title=x' });
    expect(form.status).toBe(415);
    const empty = await send('/api/tickets', {
      as: 'member',
      method: 'POST',
      headers: { origin: baseUrl, 'content-type': 'application/json' },
      body: JSON.stringify({ title: '   ' }),
    });
    expect(empty.status).toBe(400);
  });

  it('a forged token (groups edited, signature kept) is refused everywhere', async () => {
    const forged = tamperToken(personas.member.accessToken, { 'cognito:groups': ['superadmin'] });
    const response = await fetch(new URL('/api/tickets', baseUrl), { headers: { authorization: `Bearer ${forged}` } });
    expect(response.status).toBe(401);
    const page = await fetch(new URL('/admin/people', baseUrl), { headers: { authorization: `Bearer ${forged}` }, redirect: 'manual' });
    expect(page.status).toBe(307);
  });

  it('private responses are never cached, and every page carries the nonce CSP', async () => {
    const response = await send('/app', { as: 'member' });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toMatch(/no-store/);
    const csp = response.headers.get('content-security-policy') ?? '';
    const scriptSrc = /script-src ([^;]+)/.exec(csp)?.[1] ?? '';
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
    const nonce = /'nonce-([^']+)'/.exec(scriptSrc)?.[1];
    const html = await response.text();
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) expect(tag).toContain(`nonce="${nonce}"`);

    // The proxy's own answers carry the policy too, with a fresh nonce.
    const refusal = await send('/app');
    expect(refusal.status).toBe(307);
    const refusalCsp = refusal.headers.get('content-security-policy') ?? '';
    expect(refusalCsp).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/);
    expect(refusalCsp).not.toContain(`'nonce-${nonce}'`);
  });

  it('My account shows from the first paint: the authenticator gate follows the page’s guard (serverChecked)', async () => {
    const response = await send('/account', { as: 'member' });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toMatch(/data-auth-kit="totp-gate"[^>]*data-auth-kit-state="open"/);
    expect(html).toMatch(/data-auth-kit-slot="content"(?![^>]*\bhidden)[^>]*>/);
  });

  it('"Sign in as…" is closed unless ALLOW_DEV_SIGNIN=1 (the matrix server sets 0)', async () => {
    const response = await send('/api/dev/sign-in');
    expect(response.status).toBe(404);
  });
});
