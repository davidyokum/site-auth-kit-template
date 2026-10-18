# lib/dev: code that exists only under `next dev`

Nothing in this folder reaches a deployed build. Three mechanisms keep it out, and CI proves it.

| File | What it is | How it stays out of builds |
|---|---|---|
| `kit.ts` | auth-kit's localhost kit: personas, "Sign in as…" | Imported only by `on.tsx` and `app/api/dev/sign-in/route.dev.ts` |
| `on.tsx` | What `@/dev` means under `next dev`: the ribbon with the sandbox check, the persona, and the "Sign in as…" menu | `withDevKit` points `@/dev` here only in the dev phase |
| `off.tsx` | What `@/dev` means in every build: the same exports, no dev code (a PREVIEW ribbon on preview branches, nothing on the live site) | Default (tsconfig `paths`) |
| `matrix.on.ts` | What `@/dev-matrix` means under `next dev`: one line re-exporting auth-kit's matrix server mode (`auth-kit/testing/matrix-server`), active only with `AUTH_KIT_MATRIX=1` and a fixture | `withDevKit` points `@/dev-matrix` here only in the dev phase |
| `matrix.off.ts` | What `@/dev-matrix` means in every build: `null`, always (it imports only a type) | Default (tsconfig `paths`) |
| `backdrop-picker.tsx` | The backdrop picker's client half (auth-kit/backdrops/picker) behind the real sign-in card | Imported only by `app/dev/backdrops/page.dev.tsx`; the picker carries auth-kit's marker |
| `backdrop-route.ts` | The picker's "Use this one": writes `site.config.ts` (locked, with a backup) after the localhost gates | Imported only by `app/api/dev/backdrop/route.dev.ts` |

1. **`.dev.ts` routes.** Under `next dev`, `withDevKit` (next.config.ts) adds `dev.ts`/`dev.tsx` to the page extensions, so `route.dev.ts` is a route. In a build it isn't, and nothing imports it.
2. **The aliases.** `next.config.ts` passes auth-kit's `DEV_ALIAS` and `DEV_MATRIX_ALIAS`, which name exactly these files. Code that ships imports `@/dev` and `@/dev-matrix`, never these files or `auth-kit/testing/matrix-server` by path (ESLint enforces it; `test/unit/route-guards.test.ts` too). Type checks and builds resolve the aliases to the `off` modules.
3. **The markers.** auth-kit's dev sign-in route and persona menu carry one marker string, its matrix server mode another. `npx auth-kit check-prod-build` fails if a build contains either or registers `/api/dev/sign-in`; `npx auth-kit check-dev-route` proves the deployed server answers forged requests to that route with 404. Both run in CI and in `amplify.yml`.

## The matrix server mode

The auth matrix (test/matrix) runs every route as every persona against the real app under `next dev`, in CI, where there's no AWS. `startMatrixServer` (test/matrix/global-setup.ts) starts that server with `AUTH_KIT_MATRIX=1` and a fixture describing each persona. Then `matrixOverrides()` hands the app what to swap in, and the app uses it in four places:

- `lib/auth.ts`: `serverAuth`, so tokens verify against the test issuer's public keys (nothing is fetched from the pool) and a scripted Cognito answers the authenticator check and live re-reads, refusing a disabled account and a revoked session the way Cognito does.
- `lib/admin.ts`: `peopleCognito` (reads the fixture, refuses every change) and `mailer` (sends nothing).
- `lib/audit-log.ts`: `auditLog`, in memory.
- `lib/projects/index.ts`: `shared('projects', createMemoryProjectStore)`, the app's own in-memory store, one per server process, so a project the API creates shows on the page.
- `lib/resources.ts`: `matrix.resources`, auth-kit's in-memory membership store (who has which role on which project), shared by every bundle.

Everything else is the production code path: the same proxy, guards, capability map, and pages. auth-kit returns `null` unless `NODE_ENV` is `development` and the flag is set, and throws (never falls back to AWS) if the flag comes without a fixture. Its proxy honors the matrix's "without proxy" pass only outside production builds, only with that flag, and only on a loopback URL. Details: auth-kit's README ("Auth-matrix tests") and ADR 0016.

## Keeping on and off in step

`on.tsx` and `off.tsx` export the same names, and `matrix.on.ts` and `matrix.off.ts` both export just `matrixOverrides` (a unit test checks). Add an export to both or neither.
