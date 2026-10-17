# AGENTS.md

Rules for AI coding agents (and people) working on this site. It started from
`site-auth-kit-template`: Next.js 16 (App Router) on AWS Amplify Gen 2, with sign-in and
authorization from [auth-kit](https://github.com/davidyokum/auth-kit). auth-kit's README maps each
rule of the login standard (cited in comments as "03 §2"; kept privately) to the code that
enforces it; this file says how to work inside it.

## Site record

Fill in when the site is created (03 §2 Assurance: tier, pool, and account are recorded here).

- **Tier:** 2 (named people). See `site.config.ts`.
- **AWS account, profile, and Amplify app ID:** `deploy.config.json` (every AWS-touching script checks it
  first; the hygiene test allows its `awsAccountId` and `amplifyAppId` and no other IDs).
- **Pools:** one per Amplify branch, plus each developer's sandbox. Never shared, never hand-edited.

## Rules

1. **Sign in on localhost only as a persona, never with real credentials.** Use "Sign in as…" in
   the ribbon, or `POST /api/dev/sign-in` with `{"persona":"editor"}` from the page's own origin
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
4. **Capabilities, not role names.** Ask `requireCan('tickets.read-all')`, never "is she an admin".
   Group names appear only in `lib/capabilities.ts`.
5. **Records answer 404 to anyone else.** A route that takes a record ID loads the record and calls
   `auth.requireRecordAccess(user, record, { owner, members, coveredBy })`. Lists are filtered in
   the query, on the server.
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

## Commands

```sh
npm ci
npm run dev              # http://app.localhost:3000 (bound to 127.0.0.1)
npm run check            # typecheck, lint, unit tests, build, check:prod-build, auth matrix
npm run test:matrix      # after `npm run build`
npm run sandbox          # your own sandbox backend (account-checked; ask before deploying)
npm run personas:seed    # seed personas into the sandbox (account-checked)
```

## Layout

- `site.config.ts` the site's identity, including its family; `deploy.config.json` where it deploys
- `site.families.ts` the family table: sender display name and email footer text (themes later);
  the only file allowed to name an employer (with its unit test)
- `amplify/` the backend: auth preset, audit log, tickets table, SSR compute role
- `proxy.ts` default-deny proxy, token checks, session refresh, per-request CSP
- `lib/auth.ts` `auth` and `pages` guards; `lib/capabilities.ts` the one capability map
- `lib/admin.ts`, `lib/audit-log.ts`, `lib/alerts.ts` the admin area's actions, log, and alerts;
  `lib/email.ts` the sender, Reply-To, and footer on the email the site sends
- `lib/tickets/` the sample records (replace with your own; keep the pattern)
- `lib/dev/` dev-only code (see its README); `app/api/dev/sign-in/route.dev.ts` "Sign in as…"
- `app/` pages: `/` and `/sign-in` public; `/account`, `/app` members; `/admin` owners and admins
- `test/unit/` unit and static checks; `test/matrix/` the auth matrix

## Git

Commit early and often. While the site isn't live, commit to `main`. Once it's deployed, work on a
branch: merging to `main` deploys the live site, so only the owner merges.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
