# AGENTS.md

Rules for AI coding agents (and people) working on this site. It started from
`site-auth-kit-template`: Next.js 16 (App Router) on AWS Amplify Gen 2, with sign-in and
authorization from [auth-kit](https://github.com/davidyokum/auth-kit). auth-kit's README maps each
rule of the login standard (cited in comments as "03 §2"; kept privately) to the code that
enforces it; this file says how to work inside it.

## Site record

Fill in when the site is created (03 §2 Assurance: tier, pool, and account are recorded here).

- **Tier:** 2 (named people). See `site.config.ts`.
- **Account creation:** `site.config.ts` `accountCreation` (the template: invite only).
- **Sender and help address:** `site.config.ts` `email.fromAddress` and `email.replyTo` (null: the family's
  `sign-in@` mailbox and help mailbox in `site.families.ts`; personal: sign-in@yokum.app, help@yokum.app).
- **Card style:** `site.config.ts` `cardStyle` (the template: 'quiet').
- **AWS account, profile, Amplify app ID, and the user pool's web ACL:** `deploy.config.json` (every
  AWS-touching script checks it first; the hygiene test allows its `awsAccountId` and `amplifyAppId` and
  no other IDs; `webAcl` is the account's shared ACL, "own", or null until chosen).
- **Pools:** one per Amplify branch, plus each developer's sandbox. Never shared, never hand-edited.

## Rules

1. **Sign in on localhost only as a persona, never with real credentials.** Use "Sign in as…" in
   the ribbon, or `POST /api/dev/sign-in` with `{"persona":"admin-content"}` from the page's own origin
   (`http://app.localhost:3000`). Personas are throwaway sandbox accounts from `personas.json`. Never
   ask for, type, paste, or store anyone's real password, code, or passkey, and never sign in to a
   deployed site on someone's behalf.
2. **Never point localhost at a live pool.** `amplify_outputs.json` must come from
   `npm run sandbox` (your own sandbox). If the ribbon is red ("not a sandbox pool"), stop and
   say so. Don't copy a branch's outputs file onto your machine.
3. **Every route needs its own server check.** Pages and layouts call `pages.requireUser()` /
   `pages.requireCan('…')`; route handlers and server actions call `auth.requireUser()` /
   `auth.requireCan('…')` (route handlers wrapped in `withAuthErrors`). The proxy is a first
   checkpoint, never the only one. A new public page goes in `lib/public-routes.ts` (exact paths,
   never a wildcard) and gets a matrix row that says it's public.
4. **Capabilities, not role names.** Ask `requireCan('people.manage')`, never "is she an admin".
   Group names appear only in `lib/capabilities.ts`.
5. **Items answer 404 to anyone without access.** A page, route, or action that takes an item's ID
   calls `requireResourceRole('project', id, 'view' | 'edit' | …)` first (`pages.` on pages): the
   person's role on that item (Manager, Contributor, Reader) or their site role's floor. Lists come
   from `auth.listMyResources`, filtered on the server. Access changes go through
   `resourceActions()` (lib/resource-actions.ts), which checks live, keeps a Manager, and logs.
   Screens use the item's noun, never "resource" or "record".
6. **Run the auth matrix.** Every page and route needs a row in `test/matrix/auth-matrix.test.ts`
   (an uncovered route fails it). Server actions aren't in the matrix: test them in
   `test/unit/actions.test.ts`. Before you finish: `npm run check`.
7. **Admin writes check live and log.** Admin pages and actions use `{ live: true }`; risky actions
   (granting a role, exporting, deleting) add `recentSignIn: true`. Changes go through
   `recordChange` (or auth-kit's People actions, which log for you).
8. **Don't weaken the walls.** No `'unsafe-inline'` scripts in the CSP, no `dangerouslySetInnerHTML`,
   no catch-all public routes, no imports of `auth-kit/dev`, `auth-kit/dev/menu`, `auth-kit/testing`
   (or `auth-kit/testing/matrix-server`), or `lib/dev/*` from code that ships (ESLint and the unit
   tests refuse them).
9. **AWS only through the preflight, and no deploys without the owner's go-ahead.** Never run an
   unqualified `aws` command. Use `npm run sandbox`, `npm run personas:seed`,
   `npm run preview:password`, which check the account in `deploy.config.json` first. Tests never
   call AWS (the unit tests and the matrix server have no credentials by design).
10. **No secrets in the repo.** Persona secrets live in `.env.local` (git-ignored, written by the
    seed script). Real secrets go in Amplify `secret()` or Secrets Manager. Never commit
    `amplify_outputs.json` or any `.env*` file other than `.env.local.example`.
11. **Honest data.** A failed fetch shows "—" and the reason, never an empty list or a zero.
12. **Read the guides before changing auth.** auth-kit's README and `node_modules/auth-kit/docs/`
    (the localhost guide and the decision records), and `lib/dev/README.md` here.
13. **The help address is a role-based mailbox, and required.** Never put a person's own address in
    `email.replyTo` or the family table unless the owner says the site is deliberately one person's,
    and then only as `{ address, personal: true }` (register E4c; auth-kit refuses it otherwise, and
    `next dev` stops on it). Screens and emails read the address in effect through `lib/accounts.ts`
    (`effectiveHelp()`, `signInHelp()`), so a Super admin's override (Admin → Settings) shows at once;
    never hard-code it in a page.
14. **Account creation follows the one setting.** Pages and routes that only some modes have are
    `page.signup.tsx` / `route.signup.ts` (sign-up sites) or `page.request.tsx` / `route.request.ts`
    (request sites); `next.config.ts` makes them routes only there, `lib/public-routes.ts` lists them
    only there, and the matrix adds their rows. Use `lib/account-modes.ts` for "does this site take
    sign-ups / requests", never `mode === '…'` checks of your own. Cognito's own sign-up stays off.
15. **The first credential is required.** After an invite's or a sign-up's first emailed code, people
    must choose a passkey or a password plus authenticator (`/account/sign-in-method`). Only that page
    passes `allowFirstCredentialEnrollment`; don't add it anywhere else, and don't offer a "Not now".
16. **The sign-in card is auth-kit's.** Render `SignIn`, `SignUp`, `RequestAccess`,
    `SignedOutEverywhere`, or `AuthCard` with the site's theme (`lib/theme.ts`) inside `AuthScene`;
    don't wrap them in a card of your own, add words above the heading, or restyle their slots beyond
    `authKitStyles`. Words come from auth-kit's copy deck (Oxford commas).
17. **Every email matches the card.** Send through the site's mailer (`lib/accounts.ts`
    `accountMailer()`, `lib/email.ts`): the site's reply-able `sign-in@` mailbox (never `noreply@`;
    register A10; personal sites only sign-in@yokum.app, F11) under the family's sender name, the help address as Reply-To, the card's layout and
    footer. The custom message trigger (`amplify/auth/custom-message/`) is a security control: keep
    `customMessageHandler` (or wrap your wording in `withAuthKitCustomMessage`) and its
    `CUSTOM_MESSAGE_GATE_ENV`.
18. **Account-change notices stay on.** auth-kit's screens post to `/api/auth-kit/account-notice`
    after a new passkey or password (register A10); the route (`accountNotices()` in lib/accounts.ts)
    checks the session itself and emails only the account's own address. `SignIn` gets
    `notices={{ mounted: true }}`; don't pass `notices={false}`, and keep the rate-limit table on every
    site (the route counts there).
19. **One shared web ACL per account** (register F7). The user pool's WAF comes from
    `deploy.config.json` `webAcl` (amplify/web-acl.ts): the account's shared ACL, or `"own"` only when
    the owner says the site is alone in its account. Sign-up sites also need `siteWaf` (register D3).

## Commands

```sh
npm ci
npm run dev              # http://app.localhost:3000 (bound to 127.0.0.1)
npm run check            # typecheck, lint, unit tests, build, check:prod-build, auth matrix
npm run test:matrix      # after `npm run build`
npm run setup            # a new site: name, family, sender, help mailbox, account creation, owner → site.config.ts
npm run sandbox          # your own sandbox backend (account-checked; ask before deploying)
npm run personas:seed    # seed personas into the sandbox (account-checked)
npm run projects:seed    # the sample project's Manager, Contributor, Reader roles (sandbox only)
npm run waf:smoke -- --url https://<site>   # open sign-up sites, after every deploy
```

## Layout

- `site.config.ts` the site's identity: family, sender, help address, card style, account-creation
  mode, code lifetime, privacy notice, site web ACL, locked backdrop, email hint, owner;
  `deploy.config.json` where it deploys (account, Region, Amplify app, the user pool's web ACL)
- `site.families.ts` the families (auth-kit themes since 0.1.8) and each family's sender and help
  mailbox (held to auth-kit's themes by a test); the only file allowed to name an employer (with its
  unit test); `lib/theme.ts` the site's auth-kit theme
- `lib/account-modes.ts` what each account-creation mode turns on; `lib/site-checks.ts` what
  site.config.ts must hold (next.config.ts runs it); `lib/accounts.ts` the help address in effect,
  Settings, the sign-up and request routes, members' self-service, the request queue, the
  account-change notice route, the mailer
- `components/auth-scene.tsx` the backdrop behind auth-kit's cards; `lib/backdrop.ts` what it draws and
  the build's lock check (next.config.ts); never derive the backdrop at build time, and change it only
  with `npm run backdrop:pick` or `backdrop:lock`
- `amplify/` the backend: auth preset (`auth/resource.ts`; the user pool's web ACL in `web-acl.ts`),
  the custom message and preSignUp triggers (`auth/custom-message/`, `auth/pre-sign-up/`), audit log,
  invite-expiry schedule, resource access table, site settings table, rate-limit table, each mode's
  account-creation tables and jobs, projects table, SSR compute role
- `proxy.ts` default-deny proxy, token checks, session refresh, per-request CSP
- `lib/auth.ts` `auth` and `pages` guards; `lib/capabilities.ts` the one capability map
- `lib/admin.ts`, `lib/audit-log.ts`, `lib/alerts.ts` the admin area's actions, log, and alerts;
  `lib/email.ts` the site's mailer: the sender, Reply-To, and the card's layout and footer
- `lib/resources.ts` the resource types (project) and their switches, and the membership store; `lib/resource-actions.ts` the access actions; `lib/action-response.ts` their answers as HTTP
- `lib/projects/` the sample items (replace with your own; keep the pattern)
- `lib/dev/` dev-only code (see its README); `app/api/dev/sign-in/route.dev.ts` "Sign in as…";
  `app/dev/backdrops/page.dev.tsx` and `app/api/dev/backdrop/route.dev.ts` the backdrop picker
- `app/` pages: `/`, `/sign-in`, `/signed-out` public (and `/sign-up`, `/request-access` where the mode has
  them); `/account`, `/account/sign-in-method` (the required first credential), `/app`, `/app/projects`
  members (each project by its resource roles: README, "Projects"); `/admin` every admin role, and
  `/admin/settings` Super admins and the owner (README, "Roles", "The sender and the help address");
  `app/api/auth-kit/account-notice` the account-change notices (signed-in accounts)
- `scripts/` local tools: `setup.mjs`, `seed-sample-project.mjs`, `waf-smoke-test.mjs`, the preflight,
  the backdrop picker's; never shipped
- `test/unit/` unit and static checks; `test/matrix/` the auth matrix

## Git

Commit early and often. While the site isn't live, commit to `main`. Once it's deployed, work on a
branch: merging to `main` deploys the live site, so only the owner merges.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
