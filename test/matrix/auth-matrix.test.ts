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
 *
 * Two personas need no column: `codeOnlyMember` (only emailed codes) gets auth-kit's default, what an
 * anonymous visitor gets where that's a success or a redirect (to the chooser page, here) and 403
 * elsewhere, except on the chooser page itself; and on sign-up sites `newMember` gets a member's
 * answer on every row (a second member's on project routes), and auth-kit refuses a row that would
 * let it do more.
 *
 * The account-creation rows follow site.config.ts's `accountCreation`: sign-up sites have /sign-up and
 * its route, request sites /request-access and its route, and invite-only sites neither (the build
 * doesn't have them; lib/account-modes.ts).
 */
import { type MatrixRoute, type PersonaDefinition, assertAuthMatrix, routesFromNextBuild, tamperToken } from 'auth-kit/testing';
import { join } from 'node:path';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { takesRequests, takesSignUps } from '@/lib/account-modes';
import { site } from '@/site.config';
import { MATRIX_PERSONAS, SIGN_UP_SITE, type MatrixPersonaKey, type MatrixPersonaName } from './personas';

const ROOT = join(import.meta.dirname, '..', '..');
// From global-setup.ts (auth-kit's startMatrixServer): each persona's Amplify session cookies and tokens.
const { baseUrl, personas } = inject('matrix');

/** Every persona's expected status, but the two auth-kit fills in (see the header). */
type Expect = Record<Exclude<MatrixPersonaName, 'codeOnlyMember' | 'newMember'>, number> & Partial<Record<'codeOnlyMember' | 'newMember', number>>;
/** This persona's session, which global-setup.ts made (`newMember` only on sign-up sites). */
const session = (name: MatrixPersonaKey) => {
  const found = personas[name];
  if (!found) throw new Error(`auth matrix: no persona "${name}" on this site.`);
  return found;
};
const persona = (name: MatrixPersonaKey): PersonaDefinition => ({ headers: { cookie: session(name).cookie } });
const send = (path: string, init: RequestInit & { as?: MatrixPersonaKey } = {}) => {
  const headers = new Headers(init.headers);
  if (init.as) headers.set('cookie', session(init.as).cookie);
  return fetch(new URL(path, baseUrl), { ...init, headers, redirect: 'manual' });
};

// ---- Expectations, by kind of route ------------------------------------------------------------
// 307: a page sends someone without a usable session to /sign-in?next=… (and a password user
// without an authenticator to /account/authenticator). 404: not allowed, or not theirs: pages and
// record routes never confirm that something exists.

/** Every admin role, answering the same. */
const ADMINS = (status: number) => ({ adminView: status, adminContent: status, admin: status, superadmin: status, owner: status });
/** Members, with or without a role on project A, answering the same. */
const MEMBERS = (status: number) => ({ member: status, otherMember: status, manager: status, reader: status });

/** Public pages: everyone. */
const PUBLIC: Expect = {
  anonymous: 200, ...MEMBERS(200), ...ADMINS(200),
  noAuthenticator: 200, demotedAdmin: 200, disabledAdmin: 200, revokedSession: 200,
};

/** Pages any signed-in person may open (requireUser). */
const SIGNED_IN_PAGE: Expect = {
  anonymous: 307, ...MEMBERS(200), ...ADMINS(200),
  noAuthenticator: 307, // → /account/authenticator
  demotedAdmin: 200, // not an admin page: the token's groups apply until it's refreshed (≤ 60 min)
  disabledAdmin: 307, // Cognito refuses a disabled account's token at the factor check
  revokedSession: 307, // ...and a signed-out-everywhere session's
  // codeOnlyMember: 307 (auth-kit's default) → /account/sign-in-method
};

/**
 * "Choose how you'll sign in next time" (requireUser with allowFirstCredentialEnrollment): the one page
 * an account with only emailed codes may open. Everyone signed in may; a password user without an
 * authenticator still goes to set one up first.
 */
const CHOOSER_PAGE: Expect = { ...SIGNED_IN_PAGE, codeOnlyMember: 200 };

/**
 * The authenticator setup page lets in a password user without an authenticator (and nobody else
 * who still has something to set up first: an account with only emailed codes goes to the chooser).
 * Since auth-kit 0.1.8 it reads the account's factors like every other guard, so a disabled account
 * or a signed-out-everywhere session is refused here too.
 */
const AUTHENTICATOR_PAGE: Expect = { ...SIGNED_IN_PAGE, noAuthenticator: 200 };

/**
 * Project A's page (requireResourceRole 'view'). The matrix seeds it: `admin` creates it (and so is
 * its Manager) and makes `member` a Contributor. Everyone else sees it only through a site role.
 */
const PROJECT_PAGE: Expect = {
  ...SIGNED_IN_PAGE,
  otherMember: 404, // the standard's second-member check: no role on it, so "not found"
  manager: 200, // its Manager
  reader: 200, // its Reader
  adminView: 200, // the site role is a floor on every project: Admin – view only sees it
  adminContent: 200,
  demotedAdmin: 200, // the token's groups give the floor until it's refreshed (≤ 60 min); edits check live
};

/** API routes any signed-in person may call. */
const SIGNED_IN_API: Expect = {
  anonymous: 401, ...MEMBERS(200), ...ADMINS(200),
  noAuthenticator: 403, // mfa_enrollment_required
  demotedAdmin: 200,
  disabledAdmin: 401, // account_disabled
  revokedSession: 401, // invalid_token
};

/** Seeing project A over the API: as the page, with API statuses. */
const PROJECT_API: Expect = { ...SIGNED_IN_API, otherMember: 404 };

/**
 * Creating a project (POST /api/projects): site admins who manage people (people.manage, read live),
 * since self-service creation is off (lib/resources.ts). A member, or an admin who can see but not
 * share projects, is refused (403: there's no item to hide yet).
 */
const CREATE_PROJECT_API: Expect = {
  ...SIGNED_IN_API,
  ...MEMBERS(403), adminView: 403, adminContent: 403,
  admin: 201, superadmin: 201, owner: 201,
  demotedAdmin: 403, // read live: Cognito says member now
};

/**
 * Editing project A (PATCH, requireResourceRole 'edit', live): its Contributor and anyone whose site
 * role edits every project. Admin – view only can see it but not edit it: 403, not 404.
 */
const EDIT_PROJECT_API: Expect = {
  ...PROJECT_API,
  reader: 403, // sees it, can't edit it
  adminView: 403,
  demotedAdmin: 404, // live: no admin role any more, and no role on the project
};

/**
 * Giving someone a role on project A (PUT …/access): its Managers and site admins who manage people,
 * read live. Seeing it isn't enough (403); not seeing it is 404.
 */
const GRANT_API: Expect = {
  ...PROJECT_API,
  member: 403, // a Contributor can't share it
  reader: 403, // nor can a Reader; its Manager can
  adminView: 403,
  adminContent: 403,
  demotedAdmin: 404, // live
};

/**
 * Admin pages (requireCan('people.read' | 'audit.read', { live: true })): every admin role sees the
 * admin area, Admin – view only included; what each may change is the People actions' business.
 */
const ADMIN_PAGE: Expect = {
  anonymous: 307, ...MEMBERS(404), ...ADMINS(200),
  noAuthenticator: 307,
  demotedAdmin: 404, // live re-read: Cognito says member now, so the admin area refuses at once
  disabledAdmin: 307,
  revokedSession: 307,
};

/**
 * Settings (requireCan('settings.security', { live: true })): Super admins and the owner. Other admins
 * get the admin area, but not this page.
 */
const SETTINGS_PAGE: Expect = { ...ADMIN_PAGE, adminView: 404, adminContent: 404, admin: 404 };

/**
 * The account-creation routes (public on purpose): the same answer for every address and every
 * persona, at least 800 ms later. Each row posts an address that already has an account, which gets
 * an email (none is sent under the matrix) instead of a different answer.
 */
const ACCOUNT_ROUTE: Expect = { ...PUBLIC };

// ---- The matrix -------------------------------------------------------------------------------

let projectId = '';
const json = (body: unknown) => ({ headers: { origin: baseUrl, 'content-type': 'application/json' }, body: JSON.stringify(body) });

beforeAll(async () => {
  // Through the app itself: the admin creates project A (its Manager by default)...
  const created = await send('/api/projects', { as: 'admin', method: 'POST', ...json({ name: 'Project A', summary: 'Seeded by the auth matrix.' }) });
  expect(created.status, await created.clone().text()).toBe(201);
  projectId = ((await created.json()) as { project: { id: string } }).project.id;
  // ...and gives the member Contributor, the manager Manager, and the reader Reader. The second member gets nothing.
  for (const [who, role] of [['member', 'contributor'], ['manager', 'manager'], ['reader', 'reader']] as const) {
    const granted = await send(`/api/projects/${projectId}/access`, { as: 'admin', method: 'PUT', ...json({ email: session(who).email, role }) });
    expect(granted.status, await granted.clone().text()).toBe(200);
  }
});

describe('auth matrix', () => {
  it('every route answers every persona as the standard requires, with and without the proxy', async () => {
    const routes: MatrixRoute[] = [
      { path: '/', expect: PUBLIC },
      { path: '/sign-in', expect: PUBLIC },
      { path: '/signed-out', expect: PUBLIC },
      { path: '/account', expect: SIGNED_IN_PAGE },
      { path: '/account/authenticator', expect: AUTHENTICATOR_PAGE },
      { path: '/account/sign-in-method', expect: CHOOSER_PAGE },
      { path: '/app', expect: SIGNED_IN_PAGE },
      { path: '/app/projects', expect: SIGNED_IN_PAGE },
      { path: '/app/projects/:id', expect: PROJECT_PAGE },
      { path: '/admin', expect: ADMIN_PAGE },
      { path: '/admin/people', expect: ADMIN_PAGE },
      { path: '/admin/activity', expect: ADMIN_PAGE },
      { path: '/admin/settings', expect: SETTINGS_PAGE },
      { method: 'GET', path: '/api/projects', expect: SIGNED_IN_API },
      {
        method: 'POST',
        path: '/api/projects',
        headers: { origin: baseUrl },
        body: { name: 'Matrix project', summary: 'Created by the auth matrix.' },
        expect: CREATE_PROJECT_API,
      },
      { method: 'GET', path: '/api/projects/:id', expect: PROJECT_API },
      { method: 'PATCH', path: '/api/projects/:id', headers: { origin: baseUrl }, body: { summary: 'Edited by the auth matrix.' }, expect: EDIT_PROJECT_API },
      { method: 'GET', path: '/api/projects/:id/access', expect: PROJECT_API },
      // Re-giving the member the role they have: changes nothing, so every persona sees the same project.
      { method: 'PUT', path: '/api/projects/:id/access', headers: { origin: baseUrl }, body: { email: session('member').email, role: 'contributor' }, expect: GRANT_API },
      ...(takesSignUps(site.accountCreation)
        ? [
            { path: '/sign-up', expect: PUBLIC },
            { method: 'POST', path: '/api/auth/sign-up', headers: { origin: baseUrl }, body: { email: session('member').email }, expect: ACCOUNT_ROUTE },
          ]
        : []),
      ...(takesRequests(site.accountCreation)
        ? [
            { path: '/request-access', expect: PUBLIC },
            {
              method: 'POST',
              path: '/api/auth/request-access',
              headers: { origin: baseUrl },
              body: { name: 'Matrix Requester', email: session('member').email, reason: 'Checking every persona gets the same answer.' },
              expect: ACCOUNT_ROUTE,
            },
          ]
        : []),
    ];
    const personaNames = Object.keys(MATRIX_PERSONAS) as MatrixPersonaKey[];

    const results = await assertAuthMatrix({
      request: (request) => fetch(request, { redirect: 'manual' }),
      baseUrl,
      appRoutes: routesFromNextBuild(join(ROOT, '.next')),
      personas: {
        anonymous: {},
        ...Object.fromEntries(personaNames.map((name) => [name, persona(name)])),
      },
      params: { id: projectId },
      routes,
      // Sign-up sites: auth-kit requires newMember and holds it to a member's answers.
      signUpSite: SIGN_UP_SITE,
    });
    // Every route × every persona (anonymous too) × 2 passes.
    expect(results.length).toBe(routes.length * (personaNames.length + 1) * 2);
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

  it('lists are filtered on the server: project A’s Manager, Contributor, Reader, and site admins see it; the second member never does', async () => {
    const list = async (as: MatrixPersonaKey) => {
      const response = await send('/api/projects', { as });
      expect(response.status).toBe(200);
      return (await response.json()) as { scope: string; projects: { id: string; role: string | null }[] };
    };
    const member = await list('member');
    expect(member.scope).toBe('mine');
    expect(member.projects.find((p) => p.id === projectId)).toMatchObject({ role: 'contributor' });
    expect((await list('manager')).projects.find((p) => p.id === projectId)).toMatchObject({ role: 'manager' });
    expect((await list('reader')).projects.find((p) => p.id === projectId)).toMatchObject({ role: 'reader' });
    expect((await list('otherMember')).projects.map((p) => p.id)).not.toContain(projectId);
    for (const admin of ['adminView', 'adminContent', 'admin', 'owner'] as const) {
      const seen = await list(admin);
      expect(seen.scope, admin).toBe('all');
      expect(seen.projects.map((p) => p.id), admin).toContain(projectId);
    }
    expect((await list('admin')).projects.find((p) => p.id === projectId)).toMatchObject({ role: 'manager' });
  });

  it('who has access: the admin and the manager are Managers, the member Contributor, the reader Reader; the page shows the panel in the project’s words', async () => {
    const access = await send(`/api/projects/${projectId}/access`, { as: 'member' });
    expect(access.status).toBe(200);
    const body = (await access.json()) as { members: { sub: string; role: string }[]; managers: number };
    expect(body.managers).toBe(2);
    const roles = Object.fromEntries(body.members.map((m) => [m.sub, m.role]));
    expect(roles).toEqual({
      [session('admin').sub]: 'manager',
      [session('manager').sub]: 'manager',
      [session('member').sub]: 'contributor',
      [session('reader').sub]: 'reader',
    });
    const page = await send(`/app/projects/${projectId}`, { as: 'admin' });
    const html = await page.text();
    expect(html).toContain('Who has access to this project');
    expect(html).toContain('Share this project');
    // Its Manager (a member with no site role) can share it; the Contributor and the Reader see the list but can't.
    expect(await (await send(`/app/projects/${projectId}`, { as: 'manager' })).text()).toContain('Share this project');
    for (const who of ['member', 'reader'] as const) {
      const html = await (await send(`/app/projects/${projectId}`, { as: who })).text();
      expect(html, who).toContain('Who has access to this project');
      expect(html, who).not.toContain('Share this project');
    }
  });

  it('the Activity page names project A and its people, never an ID (register rule C5)', async () => {
    const html = await (await send('/admin/activity', { as: 'owner' })).text();
    // What the page shows: its text, without scripts (the client component's props travel in them).
    const shown = html.replace(/<script\b[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');
    expect(shown).toContain('the project “Project A”');
    expect(shown).toContain(session('member').email);
    expect(shown).not.toContain(projectId);
    for (const name of Object.keys(personas) as MatrixPersonaKey[]) expect(shown, name).not.toContain(session(name).sub);
  });

  it('every item keeps a Manager: the only Manager can’t demote themselves through the API', async () => {
    // A project of its own, whose only Manager is the admin who made it.
    const created = await send('/api/projects', { as: 'admin', method: 'POST', ...json({ name: 'One-Manager project' }) });
    expect(created.status).toBe(201);
    const id = ((await created.json()) as { project: { id: string } }).project.id;
    const response = await send(`/api/projects/${id}/access`, { as: 'admin', method: 'PUT', ...json({ email: session('admin').email, role: 'reader' }) });
    expect(response.status).toBe(409);
    expect((await response.json()) as { guardrail: string }).toMatchObject({ guardrail: 'last_manager' });
  });

  it('an account with only emailed codes is sent to the chooser page, and refused by APIs (first credential required)', async () => {
    const page = await send('/app', { as: 'codeOnlyMember' });
    expect(page.status).toBe(307);
    expect(page.headers.get('location')).toMatch(/\/account\/sign-in-method$/);
    const api = await send('/api/projects', { as: 'codeOnlyMember' });
    expect(api.status).toBe(403);
    expect(((await api.json()) as { error: string }).error).toBe('first_credential_required');
    expect((await send('/account/sign-in-method', { as: 'codeOnlyMember' })).status).toBe(200);
  });

  it('a state change from another origin is refused (403 origin_mismatch)', async () => {
    const response = await send('/api/projects', {
      as: 'admin',
      method: 'POST',
      headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Cross-site' }),
    });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { error: string }).error).toBe('origin_mismatch');

    // Only the configured origin counts (lib/origin.ts), not request.url's (next dev says localhost).
    const localhost = await send(`/api/projects/${projectId}`, {
      as: 'member',
      method: 'PATCH',
      headers: { origin: baseUrl.replace('127.0.0.1', 'localhost'), 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Wrong origin' }),
    });
    expect(localhost.status).toBe(403);
  });

  it('input is validated on the server (415 for non-JSON, 400 for a bad name)', async () => {
    const form = await send('/api/projects', { as: 'admin', method: 'POST', headers: { origin: baseUrl, 'content-type': 'text/plain' }, body: 'name=x' });
    expect(form.status).toBe(415);
    const empty = await send('/api/projects', { as: 'admin', method: 'POST', ...json({ name: '   ' }) });
    expect(empty.status).toBe(400);
    const badRole = await send(`/api/projects/${projectId}/access`, { as: 'admin', method: 'PUT', ...json({ email: session('otherMember').email, role: 'owner' }) });
    expect(badRole.status).toBe(400);
  });

  it('a forged token (groups edited, signature kept) is refused everywhere', async () => {
    const forged = tamperToken(session('member').accessToken, { 'cognito:groups': ['owner'] });
    const response = await fetch(new URL('/api/projects', baseUrl), { headers: { authorization: `Bearer ${forged}` } });
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
