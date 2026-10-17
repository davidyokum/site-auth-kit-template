# lib/dev: code that exists only under `next dev`

Nothing in this folder reaches a deployed build. Three mechanisms keep it out, and CI proves it.

| File | What it is | How it stays out of builds |
|---|---|---|
| `kit.ts` | auth-kit's localhost kit: personas, "Sign in as…" | Imported only by `on.tsx` and `app/api/dev/sign-in/route.dev.ts` |
| `on.tsx` | What `@/dev` means under `next dev`: the ribbon with the sandbox check, the persona, and the "Sign in as…" menu | `withDevKit` points `@/dev` here only in the dev phase |
| `off.tsx` | What `@/dev` means in every build: the same exports, no dev code (a PREVIEW ribbon on preview branches, nothing on the live site) | Default (tsconfig `paths`) |
| `matrix.on.ts` | What `@/dev-matrix` means under `next dev`: the auth-matrix overrides (test issuer's keys, scripted Cognito, in-memory data), active only with `AUTH_KIT_MATRIX=1` and a fixture | `withDevKit` points `@/dev-matrix` here only in the dev phase |
| `matrix.off.ts` | What `@/dev-matrix` means in every build: `null`, always | Default (tsconfig `paths`) |
| `matrix-types.ts` | Types shared by the matrix test and `matrix.on.ts` | Types only |

1. **`.dev.ts` routes.** Under `next dev`, `withDevKit` (next.config.ts) adds `dev.ts`/`dev.tsx` to the page extensions, so `route.dev.ts` is a route. In a build it isn't, and nothing imports it.
2. **The aliases.** Code that ships imports `@/dev` and `@/dev-matrix`, never these files by path (ESLint enforces it; `test/unit/route-guards.test.ts` too). Type checks and builds resolve the aliases to the `off` modules.
3. **The marker.** auth-kit's dev sign-in route, its persona menu, and `matrix.on.ts` carry auth-kit's marker string. `npx auth-kit check-prod-build` fails if a build contains it or registers `/api/dev/sign-in`; `npx auth-kit check-dev-route` proves the deployed server answers forged requests to that route with 404. Both run in CI and in `amplify.yml`.

## Why the matrix overrides exist

The auth matrix (test/matrix) runs every route as every persona against the real app under `next dev`, in CI, where there's no AWS. So under `AUTH_KIT_MATRIX=1` the server verifies tokens against the test issuer's public keys and asks a scripted Cognito about each person. Everything else is the production code path: the same proxy, guards, capability map, and pages. auth-kit's proxy honors the matrix's "without proxy" pass only outside production builds, only with that flag, and only on a loopback URL; `matrix.on.ts` adds the same development-only check.

## Keeping on and off in step

`on.tsx` and `off.tsx` export the same names, as do `matrix.on.ts` and `matrix.off.ts` (a unit test checks). Add an export to both or neither.
