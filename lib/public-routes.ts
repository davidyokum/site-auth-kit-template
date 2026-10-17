/**
 * The exact paths anyone may load without signing in (proxy.ts). Everything else is default-deny.
 * `/sign-in` is always public (auth-kit adds it). Add sparingly, never a catch-all (auth-kit refuses
 * those at startup), and give every public page a matrix row that says so (test/matrix).
 *
 * `/api/dev/sign-in` is listed in every environment, as auth-kit's localhost kit requires: under
 * `next dev` the route runs its own gates; in a build it doesn't exist, so the answer is Next's 404
 * (a 401 from the proxy would hide that). `npm run check:prod-build` proves it's absent.
 */
export const PUBLIC_ROUTES = ['/', '/api/dev/sign-in'] as const;

/** Pages that render for anonymous visitors (they call no guard, or only `getUser` for display). */
export const PUBLIC_PAGES = ['/', '/sign-in'] as const;
