/**
 * The site's public origin, from configuration, never from request headers.
 *
 * - `expectedOrigin()` is what state-changing route handlers compare `Origin` with
 *   (`assertSameOrigin(request, { expectedOrigin: expectedOrigin() })`, a unit test checks). auth-kit
 *   asks for it in every environment (0.1.2, #8), and it's set from configuration in each: behind
 *   Amplify Hosting's CDN the origin rebuilt from `request.url` may not match the browser's scheme,
 *   and under `next dev` Next 16 rewrites `request.url` to `http://localhost:<port>` whatever the
 *   Host. (auth-kit now also accepts the browser's loopback origin under `next dev`, but a
 *   configured origin wins, so this one is what's compared.)
 * - `publicOrigin()` builds absolute links (the sign-in URL in invite emails).
 *
 * Production reads `APP_ORIGIN` (set it per branch in Amplify for a custom domain), else the
 * branch's default Amplify address from `AWS_BRANCH` and `AWS_APP_ID`. Amplify passes these to the
 * server only because amplify.yml writes them into `.env.production` during the build.
 * Development uses site.config.ts's `http://<app>.localhost:<port>`; the auth-matrix server, which
 * runs on another port, sets `SITE_DEV_ORIGIN` to its own loopback origin.
 */
import { devOrigin } from '@/site.config';

function checkedOrigin(value: string, name: string, allowHttpLoopback: boolean): string {
  let url: URL | null = null;
  try {
    url = new URL(value);
  } catch {
    // reported below
  }
  const loopback = url !== null && (url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname === '127.0.0.1');
  const schemeOk = url !== null && (url.protocol === 'https:' || (allowHttpLoopback && url.protocol === 'http:' && loopback));
  if (!url || url.origin !== value || !schemeOk) {
    throw new Error(
      allowHttpLoopback
        ? `${name} "${value}" must be a loopback origin like http://app.localhost:3000 (no path or trailing slash).`
        : `${name} "${value}" must be an https origin like https://www.example.com (no path or trailing slash).`,
    );
  }
  return value;
}

/** Amplify's default address for a branch: `https://<branch>.<appId>.amplifyapp.com` (slashes become hyphens). */
export function amplifyBranchOrigin(branch: string | undefined, appId: string | undefined): string | undefined {
  if (!branch || !appId || !/^[a-z0-9]+$/i.test(appId)) return undefined;
  const label = branch.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `https://${label}.${appId.toLowerCase()}.amplifyapp.com`;
}

function configuredOrigin(env: NodeJS.ProcessEnv): string | undefined {
  if (env.NODE_ENV === 'development') {
    const override = env.SITE_DEV_ORIGIN?.trim();
    return override ? checkedOrigin(override, 'SITE_DEV_ORIGIN', true) : devOrigin;
  }
  const explicit = env.APP_ORIGIN?.trim();
  if (explicit) return checkedOrigin(explicit, 'APP_ORIGIN', false);
  return amplifyBranchOrigin(env.AWS_BRANCH, env.AWS_APP_ID);
}

/**
 * The origin `assertSameOrigin` expects. Undefined only in a production build with neither
 * APP_ORIGIN nor the Amplify branch variables (a bare `next start`; on Amplify, amplify.yml always
 * writes the branch variables), where auth-kit falls back to `request.url`'s origin and refuses
 * anything else: it fails closed.
 */
export function expectedOrigin(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return configuredOrigin(env);
}

/** The origin for absolute links. Throws, rather than guessing, when production has none. */
export function publicOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const origin = configuredOrigin(env);
  if (!origin) {
    throw new Error('No public origin: set APP_ORIGIN for this branch in Amplify (amplify.yml writes it into .env.production).');
  }
  return origin;
}
