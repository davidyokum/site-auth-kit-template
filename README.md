# site-auth-kit-template

The starter site for David Yokum's websites: a small, real Next.js 16 (App Router) site on AWS Amplify Gen 2, wired to [auth-kit](https://github.com/davidyokum/auth-kit). It meets the login standard out of the box (passkey-first sign-in, server-side checks on every route, an admin area with an append-only log, and a localhost kit for signing in as test personas) and the tests fail if a change breaks it.

> Pre-release, like auth-kit (`v0.1.5-alpha`). Deployed once, as a private demo (2026-10-17): see [Verified on a live deploy, and what's left](#verified-on-a-live-deploy-and-whats-left).

Comments cite the login standard as "03 §2" (its rules) and "03 §1" (its tiers). The standard itself is kept privately; [auth-kit's README](https://github.com/davidyokum/auth-kit#how-the-standard-maps-to-the-code) maps every rule to the code that enforces it.

## What you get

| Piece | Where |
|---|---|
| The user pool: invite-only, passkey first, then password + authenticator code, then emailed code; MFA optional with TOTP required of password users; 60-minute tokens, 30-day refresh (Tier 2); deletion protection; WAF rate rules (the sign-in rule counts first, the overall rule blocks); the site-wide role groups ([Roles](#roles)) | `amplify/auth/resource.ts`, `amplify/backend.ts` (auth-kit's preset) |
| Default-deny proxy that verifies tokens, refreshes sessions server-side, and sets a per-request nonce CSP | `proxy.ts`, `lib/security-headers.ts` |
| A guard on every page, layout, route handler, and server action; one capability map | `lib/auth.ts`, `lib/capabilities.ts` |
| Pages: `/` (public), `/sign-in`, `/account` (My account), `/account/authenticator`, `/app` (members' tickets; another member's ticket is a 404), `/admin` (People and Activity, for every admin role; what each may change follows its role); `/api/tickets` (sample API) | `app/` |
| Append-only audit log, grant/removal alerts, invite expiry (an hourly schedule disables invites unused for 7 days), SSR compute role with exact permissions | `lib/audit-log.ts`, `lib/alerts.ts`, `amplify/backend.ts`, `amplify/compute-role.ts` |
| Localhost kit: personas, "Sign in as…", environment ribbon, `[DEV]` tab title, dev code kept out of builds | `personas.json`, `lib/dev/`, `app/api/dev/sign-in/route.dev.ts` |
| Account-assert preflight, branch passwords for previews | `scripts/preflight.mjs`, `scripts/preview-password.mjs` |
| Tests: the auth matrix (every route × 12 personas, with and without the proxy), unit and static checks, production-build checks, CI | `test/`, `.github/workflows/ci.yml` |

## Roles

Every site has the same site-wide admin roles (auth-kit [ADR 0020](https://github.com/davidyokum/auth-kit/blob/main/docs/decisions/0020-site-wide-roles.md)). Each role includes everything below it.

| Role (as screens show it) | Group | View everything | Edit any content | Manage people | Security, exports, deletion | Owner-only pages |
|---|---|---|---|---|---|---|
| Owner (only one) | `owner` | Yes | Yes | Yes, everyone but themselves | Yes | Yes |
| Super admin | `superadmin` | Yes | Yes | Roles below Super admin | Yes | No |
| Admin – content & people | `admin-content-people` | Yes | Yes | Roles below their own | No | No |
| Admin – content only | `admin-content` | Yes | Yes | No | No | No |
| Admin – view only | `admin-view` | Yes | No | No | No | No |
| Member | (no group) | Their own account and items | Only items they've been given access to | No | No | No |

- **One owner.** The owner role is never granted, not even by the owner. It moves only by **Transfer ownership…** (in the role picker, owner only): to someone who has signed in, with a reason, their address typed out, and a recent sign-in; both of you are emailed, and you become Super admin. Nobody can disable, demote, or delete the owner, and the invite-expiry schedule never disables them. The People page flags a site with no owner, or more than one.
- **Grants go down, never sideways or up.** You grant, and act on, only roles below your own, so only the owner grants Super admin, and Super admins can't manage each other. Nobody changes their own role. Every grant needs a reason and a recent sign-in; a Super admin grant also emails the owner.
- **Admin – view only and Admin – content only** open the admin area and the Activity log and see the People list, but can't change anyone.
- **Members** aren't admins. What they can see and do with a particular project, plan, or ticket is decided on that item (here: tickets are their owner's, and staff with `tickets.read-all` see all of them), never by these roles.
- The People page's role picker shows each role's can and can't, a **Compare roles** grid (this table, from auth-kit's `ROLE_MATRIX`), and the note "These roles are for running the site. Access to individual projects, plans, and other items is managed on each one." Group names appear only in `lib/capabilities.ts`, which adds the sample's `tickets.read-all` to Admin – content & people and up.

## Start a new site from this template

You need Node 22, the AWS CLI signed in to the account you'll deploy to, and a domain verified in Amazon SES in that account (with SPF, DKIM, and DMARC published), because auth email goes through SES.

1. **Make the repo.** On GitHub, **Use this template**, or:
   `gh repo create <you>/<site> --template davidyokum/site-auth-kit-template --private --clone`
2. **Install:** `npm ci` (the lockfile pins auth-kit's release tarball by hash).
3. **Name the site** in `site.config.ts`: name, family (who runs it; see [Email](#email)), project slug, owner, sender address (on your SES domain), help address (`email.replyTo`), invite domains, the alert recipients, and the local name and port (if you change those, match the `dev` and `start` scripts in `package.json`).
4. **Say where it deploys** in `deploy.config.json`: the AWS CLI profile and the 12-digit account ID it must reach. Every AWS-touching script refuses until this is right. `amplifyAppId` stays `null` until the Amplify app exists (Deploy, step 2). The hygiene test allows these two IDs, the site's own, and still fails on any other account or app ID in the repo. (Account IDs aren't secrets, but keep a public repo's copy on the placeholder.)
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
2. **Create the app** in the Amplify console: *Create new app* → GitHub → this repo → branch `main`. Amplify uses `amplify.yml`: each branch's pipeline deploys its own backend (`ampx pipeline-deploy`), writes `amplify_outputs.json`, builds, and fails the deploy if the build contains the localhost kit. New sites start on the default `amplifyapp.com` address. Put the app's ID (`d` and 13 letters or digits, as in `https://main.<app-id>.amplifyapp.com`) in `deploy.config.json` as `amplifyAppId`.
3. **Attach the compute role (once per app).** The backend creates the SSR compute role with exactly the permissions the server needs; Amplify doesn't attach it by itself. After the first deploy, copy `custom.computeRoleArn` from the branch's outputs (Amplify console → the branch → *Deployed backend resources*, or the stack's outputs) and set it as the app's compute role in the console (*App settings* → *IAM roles* → *Compute role*), or: `aws amplify update-app --app-id <app-id> --compute-role-arn <arn> --profile <profile>` (run `npm run preflight` first).
4. **Preview branches behind a password** (Tier 1): `npm run preview:password -- --app-id <app-id> --auto-branches` makes branches Amplify creates start behind a password; `-- --branch <name>` does one existing branch. It asks for the password without echoing it; keep it in your password manager.
5. **A custom domain, later:** add it in the console, set `APP_ORIGIN` for that branch (*Environment variables*), and then turn on passkeys: `passkeys: { relyingPartyId: '<that domain>' }` in `site.config.ts`. Passkeys wait for the final domain because changing it later forces everyone to register again.
6. **The owner** (once per branch pool; auth-kit doesn't bootstrap the first admin yet): create yourself the way the People page invites people, with no password and no welcome email, then sign in with an emailed code and save a passkey or set a password and authenticator. After `npm run preflight`: `aws cognito-idp admin-create-user --user-pool-id <pool> --username <your email> --user-attributes Name=email,Value=<your email> --message-action SUPPRESS --profile <profile>`, then `aws cognito-idp admin-add-user-to-group --user-pool-id <pool> --username <your email> --group-name owner --profile <profile>`. A site has exactly one owner: this is the only time the role is set outside the app (and the break-glass fix if a pool ever ends up with none). Everyone else comes in from the People page, and ownership moves with Transfer ownership.
7. **The WAF sign-in rule counts first.** The pool's web ACL has two per-IP rules: sign-in attempts, which only counts at first, and all requests, which blocks from day one. After about a week, read the sign-in rule's sampled requests (auth-kit README, "Count first, then block the sign-in rule") and set `signInRule: 'block'` in `amplify/auth/resource.ts`.
8. **More than one site in an account and Region?** Share one WAF web ACL instead of one per pool (about $7/month each): see the `waf: { webAclArn }` comment in `amplify/auth/resource.ts`. The shared ACL's rule modes are set where it's created.
9. **Invite expiry runs by itself.** `amplify/backend.ts` deploys auth-kit's `InviteExpirySweep` with every branch: hourly, it disables invites still unused after 7 days, and the Activity page shows each as "Scheduled job". It never disables the owner: an unused owner invite gets a daily email to the owner (and the first `alertEmails` address) instead. Give it an `alarmTopic` (an SNS topic someone reads) so a failed run reaches a person.

Merging to `main` deploys the live site. Once it's live, work on branches.

**pnpm instead of npm?** npm is what the template ships and tests. To switch: `pnpm import` (converts `package-lock.json`; check that auth-kit's entry in `pnpm-lock.yaml` still carries its integrity hash), then `pnpm install`, `pnpm dev`, `pnpm run check`, and in `amplify.yml` replace `npm ci` with `corepack enable && pnpm install --frozen-lockfile`.

## The checks

| Command | What it proves |
|---|---|
| `npm run typecheck` | The app and `amplify/` type-check (with the dev aliases resolved to their production modules) |
| `npm run lint` | Next's rules, no `dangerouslySetInnerHTML`, no dev or test imports from code that ships; zero warnings |
| `npm test` | Unit and static checks: a guard on every page, layout, route handler, and server action; origin checks (against the configured origin) on data-changing routes; `requireRecordAccess` on record routes; the CSP and the proxy's CSP hook; the error page's "couldn't check"; the capability map; the family's email text, sender, Reply-To, and footer; the preflight; the compute role's exact IAM permissions (CDK synthesis); no secrets, real pool IDs, or account and app IDs other than the site's own (`deploy.config.json`) in the repo; tests can't reach AWS |
| `npm run build` + `npm run check:prod-build` | A production build with no dev sign-in code, no matrix server code, and no `/api/dev/sign-in` route |
| `npx auth-kit check-dev-route` (CI) | The running production server answers forged requests to the dev route with 404 |
| `npm run test:matrix` | The auth matrix, below |

### The auth matrix

`test/matrix/` starts the real app under `next dev` with no AWS, through auth-kit's `startMatrixServer`: a local test issuer signs each persona's session, and auth-kit's matrix server mode (behind `@/dev-matrix`, never in a build) trusts only that issuer and answers the way Cognito does from a scripted fixture. Then auth-kit's `assertAuthMatrix` sends every request twice, through the proxy and with the proxy stepped aside (so a route that leans on the proxy for its 401 fails), and checks coverage against the build's route manifest: a route without a row fails, and so does a row for a route that doesn't exist.

- **Routes:** `/`, `/sign-in`, `/account`, `/account/authenticator`, `/app`, `/app/tickets/:id`, `/admin`, `/admin/people`, `/admin/activity`, `GET` and `POST /api/tickets`, `GET /api/tickets/:id`.
- **Personas:** anonymous, member, a second member, one per admin role (`adminView`, `adminContent`, `admin` for Admin – content & people, `superadmin`, `owner`), and four lifecycle cases: a password user without an authenticator (sent to setup, 403 from APIs), a demoted admin (the token still says admin; admin pages re-read live and refuse), a disabled admin and a signed-out-everywhere session (Cognito refuses their tokens, so every check fails).
- **Also checked:** sign-in redirects carry a safe return path; lists are filtered on the server; a POST from any origin but the configured one gets 403; bad input gets 400/415; a forged token is refused; private responses are `no-store`; every script tag carries the request's CSP nonce, and the proxy's redirects carry a fresh one; My account shows from the first paint (the authenticator gate follows the page's guard); "Sign in as…" is closed without `ALLOW_DEV_SIGNIN=1`.

Server actions aren't in the route manifest; `test/unit/actions.test.ts` covers them.

## Security headers

`proxy.ts` sends a per-request Content-Security-Policy through auth-kit's `nonceCspHeaders`, on every response it answers (sign-in redirects and refusals too): scripts only with that request's nonce (`'strict-dynamic'`, no `'unsafe-inline'`, no `'unsafe-eval'` outside `next dev`), no framing, no plugins, and network access only to this site, Cognito, and the breached-password check. Amplify's tokens live in cookies page scripts can read, so this policy is what keeps an injected script from running. It needs every page rendered per request, which the root layout does (`connection()`), and which private pages need anyway. `next.config.ts` adds HSTS, `nosniff`, `X-Frame-Options: DENY`, a strict referrer policy, COOP, a Permissions-Policy, and a nonce-free baseline CSP for anything the proxy doesn't handle. Details in `lib/security-headers.ts`.

## Email

All auth email goes through SES from `site.email.fromAddress`. Two settings in `site.config.ts` shape it:

- **`family`**: who runs the site, one of the families in `site.families.ts`. The template ships `'personal'` (Yokum Lab). It sets the sender's display name (the site's name, plus the family's short name for the work families) and the footer's identity line ("Made by Yokum Lab."). The design work's per-family theme will hang off the same setting; there are no visuals yet.
- **`email.replyTo`**: the family's help mailbox. It's the Reply-To on every auth email, so replies never go to a noreply address, and the footer ends "Help: {address}." Set it before real people get email.

What each email gets:

| Email | Sent by | Sender name | Reply-To | Footer |
|---|---|---|---|---|
| Sign-in and verification codes | Cognito (`amplify/auth/resource.ts`) | yes | yes | no |
| Invites; the owner's alerts (Super admin granted, ownership transferred) | auth-kit's SES mailer (`lib/email.ts`, `lib/admin.ts`) | yes | yes | yes |
| The owner's unused-invite warning, from the hourly schedule | auth-kit's sweep (`amplify/backend.ts`) | yes | no | no |
| Grant and removal alerts | `lib/alerts.ts` | yes | yes | yes |

Cognito writes its own code emails, so they get no footer. Full control of their text needs Cognito's custom email sender trigger (later).

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

Commit the lockfile: it pins the tarball's sha512, so `npm ci` refuses a tarball that changed. Only auth-kit's entries should change; if `npm i` also drops bundled (`inBundle`) entries elsewhere, put them back, or `npm ci` fails on a clean checkout. Read auth-kit's CHANGELOG for breaking changes first.

**A site made before the site-wide roles** (groups `superadmin`, `admin`, `editor`, `viewer`): the next deploy deletes `admin`, `editor`, and `viewer` and their memberships, so write down who held each first. Map `superadmin` → `superadmin` (and add one person to `owner` in the Cognito console), `admin` → `admin-content-people`, `editor` → `admin-content`, `viewer` → `admin-view`, then re-grant from the People page. Copy this template's `lib/capabilities.ts`, `personas.json`, and `/admin` pages as the starting point. auth-kit [ADR 0020](https://github.com/davidyokum/auth-kit/blob/main/docs/decisions/0020-site-wide-roles.md#migration-from-superadmin--admin--editor--viewer) has the steps.

## Verified on a live deploy, and what's left

A private demo made from this template (auth-kit 0.1.1-alpha, an Amplify branch on the personal account) checked these on 2026-10-17:

- The backend deploys on an Amplify branch: preset, audit log, tickets table, and compute role. The pool came up with the standard's settings (auth-kit README, "Verified on a live pool").
- Amplify accepts the compute role (`amplify.amazonaws.com` trust), and IAM's policy simulator allows the People page's Cognito calls on that pool only, `ses:SendEmail` on the site's identity only, and on the audit log `PutItem` and `Query` only.
- `/sign-in` renders with no console errors or CSP violations. Every response carries the nonce CSP, HSTS, and the other headers. Pages redirect to `https://…/sign-in?next=…` and `/api/tickets` answers 401. `/api/dev/sign-in` answers 404 and `check-prod-build` passes in the build. Forged tokens get 401 `invalid_token`.

Still to check (each needs a real person, or a deploy the owner approves):

- A sandbox with `npm run personas:seed`, and "Sign in as…" for each persona.
- A real sign-in: emailed code, password + TOTP, and passkeys (on the final domain), all through the CSP. Also the People and Activity pages under the compute role.
- The origin check for POSTs behind Amplify Hosting: the derived branch origin, or `APP_ORIGIN`, must match the browser's `Origin`. An anonymous POST can't test it, because auth runs first.
- Since that deploy: the family's sender name and Reply-To on each email, the invite-expiry schedule (a real invite disabled after 7 days, with its audit rows), and the WAF rules' modes.
- auth-kit's own list: [Verified on a live pool, and what's left](https://github.com/davidyokum/auth-kit#verified-on-a-live-pool-and-whats-left).

## License and provenance

[MIT](LICENSE), Copyright (c) 2026 David Yokum.

Started 2026-10-17 by David Yokum on his own time and his own computer, in his personal GitHub account. AI assistants (Claude) drafted code at his direction; those commits carry `Co-Authored-By` trailers.
