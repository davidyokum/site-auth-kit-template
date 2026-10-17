# site-auth-kit-template

The starter site for David Yokum's websites: a small, real Next.js 16 (App Router) site on AWS Amplify Gen 2, wired to [auth-kit](https://github.com/davidyokum/auth-kit). It meets the login standard out of the box (passkey-first sign-in, server-side checks on every route, an admin area with an append-only log, and a localhost kit for signing in as test personas) and the tests fail if a change breaks it.

> Pre-release, like auth-kit (`v0.1.2-alpha`). Not yet deployed anywhere: see [Verify on the first sandbox deploy](#verify-on-the-first-sandbox-deploy).

Comments cite the login standard as "03 §2" (its rules) and "03 §1" (its tiers). The standard itself is kept privately; [auth-kit's README](https://github.com/davidyokum/auth-kit#how-the-standard-maps-to-the-code) maps every rule to the code that enforces it.

## What you get

| Piece | Where |
|---|---|
| The user pool: invite-only, passkey first, then password + authenticator code, then emailed code; MFA optional with TOTP required of password users; 60-minute tokens, 30-day refresh (Tier 2); deletion protection; WAF rate rule; groups superadmin (Owner), admin, editor, viewer | `amplify/auth/resource.ts`, `amplify/backend.ts` (auth-kit's preset) |
| Default-deny proxy that verifies tokens, refreshes sessions server-side, and sets a per-request nonce CSP | `proxy.ts`, `lib/security-headers.ts` |
| A guard on every page, layout, route handler, and server action; one capability map | `lib/auth.ts`, `lib/capabilities.ts` |
| Pages: `/` (public), `/sign-in`, `/account` (My account), `/account/authenticator`, `/app` (members' tickets; another member's ticket is a 404), `/admin` (People and Activity, owners and admins only); `/api/tickets` (sample API) | `app/` |
| Append-only audit log, grant/removal alerts, SSR compute role with exact permissions | `lib/audit-log.ts`, `lib/alerts.ts`, `amplify/compute-role.ts` |
| Localhost kit: personas, "Sign in as…", environment ribbon, `[DEV]` tab title, dev code kept out of builds | `personas.json`, `lib/dev/`, `app/api/dev/sign-in/route.dev.ts` |
| Account-assert preflight, branch passwords for previews | `scripts/preflight.mjs`, `scripts/preview-password.mjs` |
| Tests: the auth matrix (every route × 11 personas, with and without the proxy), unit and static checks, production-build checks, CI | `test/`, `.github/workflows/ci.yml` |

## Start a new site from this template

You need Node 22, the AWS CLI signed in to the account you'll deploy to, and a domain verified in Amazon SES in that account (with SPF, DKIM, and DMARC published), because auth email goes through SES.

1. **Make the repo.** On GitHub, **Use this template**, or:
   `gh repo create <you>/<site> --template davidyokum/site-auth-kit-template --private --clone`
2. **Install:** `npm ci` (the lockfile pins auth-kit's release tarball by hash).
3. **Name the site** in `site.config.ts`: name, project slug, owner, sender address (on your SES domain), invite domains, the alert recipients, and the local name and port (if you change those, match the `dev` and `start` scripts in `package.json`).
4. **Say where it deploys** in `deploy.config.json`: the AWS CLI profile and the 12-digit account ID it must reach. Every AWS-touching script refuses until this is right. (Account IDs aren't secrets, but keep a public repo's copy on the placeholder.)
5. **Personas:** in `personas.json`, change the `.test` domain to your site's (for example `my-site.test`). Add one per app role if you have any.
6. **Your sandbox backend:** `npm run sandbox`. It checks the account, then runs `npx ampx sandbox --profile <profile>`, which deploys your own throwaway copy of the backend and writes `amplify_outputs.json`. Leave it running while you work.
7. **Seed the personas:** `cp .env.local.example .env.local`, then `npm run personas:seed`. It refuses anything but a sandbox pool, creates each persona with a password and an authenticator, and writes their secrets to `.env.local` (never printed).
8. **Run it:** `npm run dev`, open http://app.localhost:3000, and pick a persona from **Sign in as…** in the blue ribbon.
9. **Make it yours.** Replace the sample tickets (`lib/tickets/`, `amplify/data/`, `app/app/`) with your own records, keeping the pattern: guards on the server, lists filtered in the query, 404 for other people's records. Add a matrix row for every page and route you add. Fill in the site record in `AGENTS.md`.
10. **Check:** `npm run check` (typecheck, lint, unit tests, build, production-build check, auth matrix).

Without a sandbox, `npm run outputs:placeholder` writes a clearly fake `amplify_outputs.json` so the site builds and the tests run, but nothing can sign in.

## Deploy on Amplify

Personal projects deploy to the personal AWS account by default; whatever the account, `deploy.config.json` names it and the scripts check it.

1. **Preflight:** `npm run preflight` confirms the profile reaches the declared account (`aws sts get-caller-identity`, read-only). It's also the first step of `sandbox`, `personas:seed`, and `preview:password`.
2. **Create the app** in the Amplify console: *Create new app* → GitHub → this repo → branch `main`. Amplify uses `amplify.yml`: each branch's pipeline deploys its own backend (`ampx pipeline-deploy`), writes `amplify_outputs.json`, builds, and fails the deploy if the build contains the localhost kit. New sites start on the default `amplifyapp.com` address.
3. **Attach the compute role (once per app).** The backend creates the SSR compute role with exactly the permissions the server needs; Amplify doesn't attach it by itself. After the first deploy, copy `custom.computeRoleArn` from the branch's outputs (Amplify console → the branch → *Deployed backend resources*, or the stack's outputs) and set it as the app's compute role in the console (*App settings* → *IAM roles* → *Compute role*), or: `aws amplify update-app --app-id <app-id> --compute-role-arn <arn> --profile <profile>` (run `npm run preflight` first).
4. **Preview branches behind a password** (Tier 1): `npm run preview:password -- --app-id <app-id> --auto-branches` makes branches Amplify creates start behind a password; `-- --branch <name>` does one existing branch. It asks for the password without echoing it; keep it in your password manager.
5. **A custom domain, later:** add it in the console, set `APP_ORIGIN` for that branch (*Environment variables*), and then turn on passkeys: `passkeys: { relyingPartyId: '<that domain>' }` in `site.config.ts`. Passkeys wait for the final domain because changing it later forces everyone to register again.
6. **The first owner** (once per branch pool; auth-kit doesn't bootstrap the first admin yet): create yourself the way the People page invites people, with no password and no welcome email, then sign in with an emailed code and save a passkey or set a password and authenticator. After `npm run preflight`: `aws cognito-idp admin-create-user --user-pool-id <pool> --username <your email> --user-attributes Name=email,Value=<your email> --message-action SUPPRESS --profile <profile>`, then `aws cognito-idp admin-add-user-to-group --user-pool-id <pool> --username <your email> --group-name superadmin --profile <profile>`. Everyone else comes in from the People page.
7. **More than one site in an account and Region?** Share one WAF web ACL instead of one per pool (about $7/month each): see the `waf: { webAclArn }` comment in `amplify/auth/resource.ts`.

Merging to `main` deploys the live site. Once it's live, work on branches.

**pnpm instead of npm?** npm is what the template ships and tests. To switch: `pnpm import` (converts `package-lock.json`; check that auth-kit's entry in `pnpm-lock.yaml` still carries its integrity hash), then `pnpm install`, `pnpm dev`, `pnpm run check`, and in `amplify.yml` replace `npm ci` with `corepack enable && pnpm install --frozen-lockfile`.

## The checks

| Command | What it proves |
|---|---|
| `npm run typecheck` | The app and `amplify/` type-check (with the dev aliases resolved to their production modules) |
| `npm run lint` | Next's rules, no `dangerouslySetInnerHTML`, no dev or test imports from code that ships; zero warnings |
| `npm test` | Unit and static checks: a guard on every page, layout, route handler, and server action; origin checks on data-changing routes; `requireRecordAccess` on record routes; the CSP; the capability map; the preflight; the compute role's exact IAM permissions (CDK synthesis); no secrets, account IDs, or real pool IDs in the repo; tests can't reach AWS |
| `npm run build` + `npm run check:prod-build` | A production build with no dev sign-in code and no `/api/dev/sign-in` route |
| `npx auth-kit check-dev-route` (CI) | The running production server answers forged requests to the dev route with 404 |
| `npm run test:matrix` | The auth matrix, below |

### The auth matrix

`test/matrix/` starts the real app under `next dev` with no AWS: a local test issuer signs each persona's token, and a scripted Cognito answers the way Cognito does (`lib/dev/matrix.on.ts`). Then auth-kit's `assertAuthMatrix` sends every request twice, through the proxy and with the proxy stepped aside (so a route that leans on the proxy for its 401 fails), and checks coverage against the build's route manifest: a route without a row fails, and so does a row for a route that doesn't exist.

- **Routes:** `/`, `/sign-in`, `/account`, `/account/authenticator`, `/app`, `/app/tickets/:id`, `/admin`, `/admin/people`, `/admin/activity`, `GET` and `POST /api/tickets`, `GET /api/tickets/:id`.
- **Personas:** anonymous, member, a second member, viewer, editor, admin, owner, and four lifecycle cases: a password user without an authenticator (sent to setup, 403 from APIs), a demoted admin (the token still says admin; admin pages re-read live and refuse), a disabled admin and a signed-out-everywhere session (Cognito refuses their tokens, so every check fails).
- **Also checked:** sign-in redirects carry a safe return path; lists are filtered on the server; a cross-site POST gets 403; bad input gets 400/415; a forged token is refused; private responses are `no-store`; every script tag carries the request's CSP nonce; "Sign in as…" is closed without `ALLOW_DEV_SIGNIN=1`.

Server actions aren't in the route manifest; `test/unit/actions.test.ts` covers them.

## Security headers

`proxy.ts` sends a per-request Content-Security-Policy: scripts only with that request's nonce (`'strict-dynamic'`, no `'unsafe-inline'`, no `'unsafe-eval'` outside `next dev`), no framing, no plugins, and network access only to this site, Cognito, and the breached-password check. Amplify's tokens live in cookies page scripts can read, so this policy is what keeps an injected script from running. It needs every page rendered per request, which the root layout does (`connection()`), and which private pages need anyway. `next.config.ts` adds HSTS, `nosniff`, `X-Frame-Options: DENY`, a strict referrer policy, COOP, a Permissions-Policy, and a nonce-free baseline CSP for anything the proxy doesn't handle. Details in `lib/security-headers.ts`.

## amplify_outputs.json

Generated, never committed (`.gitignore`). Your sandbox writes yours (`npm run sandbox`); each Amplify branch's pipeline writes its own during the build. CI copies `ci/amplify_outputs.placeholder.json`, whose IDs are fake, so builds and tests run without AWS. Code reads it only through `lib/outputs.ts`. Never copy a deployed branch's file to your machine: localhost must only ever talk to a sandbox (the ribbon turns red if it doesn't).

## Tier 3

For sensitive data, set `tier: 3` in `site.config.ts`: refresh tokens drop to 1 day and Cognito threat protection turns on in audit mode (sign-in event logs). The standard also asks for admins on a separate admin pool (its own Amplify backend, MFA required, no emailed codes, `adminPool: true`, invites with `inviteMode: 'temporary-password'`), a private database, a reviewed audit log, and a quarterly access review. See the comments in `amplify/auth/resource.ts`.

## Upgrading auth-kit

```sh
npm i https://github.com/davidyokum/auth-kit/releases/download/vX.Y.Z/auth-kit-X.Y.Z.tgz
gh release download vX.Y.Z --repo davidyokum/auth-kit --pattern '*.tgz' && gh attestation verify auth-kit-X.Y.Z.tgz --repo davidyokum/auth-kit
npm run check
```

Commit the lockfile: it pins the tarball's sha512, so `npm ci` refuses a tarball that changed. Read auth-kit's CHANGELOG for breaking changes first.

## Verify on the first sandbox deploy

Checked by synthesis and tests, not yet against a live deploy:

- The backend deploys as a sandbox (preset, audit log, tickets table, compute role) and `npm run personas:seed` seeds every persona.
- "Sign in as…" works for each persona, and each sees what the matrix says it should.
- The compute role's trust policy (`amplify.amazonaws.com`) is what Amplify Hosting accepts, and the People page works under it.
- The CSP lets Amplify's sign-in calls through: emailed code, password + TOTP, and (on the final domain) passkeys; no violations in the browser console.
- Behind Amplify Hosting, `APP_ORIGIN` / the derived branch origin matches the browser's `Origin`, so POSTs pass the origin check.
- auth-kit's own list: [Verify on the first sandbox deploy](https://github.com/davidyokum/auth-kit#verify-on-the-first-sandbox-deploy).

## License and provenance

[MIT](LICENSE), Copyright (c) 2026 David Yokum.

Started 2026-10-17 by David Yokum on his own time and his own computer, in his personal GitHub account. AI assistants (Claude) drafted code at his direction; those commits carry `Co-Authored-By` trailers.
