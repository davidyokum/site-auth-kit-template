/**
 * The site's public origin, from configuration, never from request headers.
 *
 * - `expectedOrigin()` is what state-changing route handlers compare `Origin` with
 *   (`assertSameOrigin`). Behind Amplify Hosting's CDN the origin rebuilt from `request.url` may not
 *   match the browser's scheme, so production compares with configuration.
 * - `publicOrigin()` builds absolute links (the sign-in URL in invite emails).
 *
 * Production reads `APP_ORIGIN` (set it per branch in Amplify for a custom domain), else the
 * branch's default Amplify address from `AWS_BRANCH` and `AWS_APP_ID`. Amplify passes these to the
 * server only because amplify.yml writes them into `.env.production` during the build.
 */
import { devOrigin } from '@/site.config';

function checkedOrigin(value: string, name: string): string {
  let url: URL | null = null;
  try {
    url = new URL(value);
  } catch {
    // reported below
  }
  if (!url || url.origin !== value || (url.protocol !== 'https:' && url.hostname !== 'localhost' && !url.hostname.endsWith('.localhost'))) {
    throw new Error(`${name} "${value}" must be an https origin like https://www.example.com (no path or trailing slash).`);
  }
  return value;
}

/** Amplify's default address for a branch: `https://<branch>.<appId>.amplifyapp.com` (slashes become hyphens). */
export function amplifyBranchOrigin(branch: string | undefined, appId: string | undefined): string | undefined {
  if (!branch || !appId || !/^[a-z0-9]+$/i.test(appId)) return undefined;
  const label = branch.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `https://${label}.${appId.toLowerCase()}.amplifyapp.com`;
}

function productionOrigin(env: NodeJS.ProcessEnv): string | undefined {
  const explicit = env.APP_ORIGIN?.trim();
  if (explicit) return checkedOrigin(explicit, 'APP_ORIGIN');
  return amplifyBranchOrigin(env.AWS_BRANCH, env.AWS_APP_ID);
}

/**
 * The origin `assertSameOrigin` expects, or undefined to compare with `request.url`'s own origin.
 * Under `next dev` that's the request URL (the dev server is loopback-only, and the auth-matrix
 * tests run it on another port).
 */
export function expectedOrigin(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.NODE_ENV === 'development') return undefined;
  return productionOrigin(env);
}

/** The origin for absolute links. Throws, rather than guessing, when production has none. */
export function publicOrigin(env: NodeJS.ProcessEnv = process.env): string {
  if (env.NODE_ENV === 'development') return devOrigin;
  const origin = productionOrigin(env);
  if (!origin) {
    throw new Error('No public origin: set APP_ORIGIN for this branch in Amplify (amplify.yml writes it into .env.production).');
  }
  return origin;
}
