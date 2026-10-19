/**
 * The user pool's WAF web ACL (register F7; auth-kit ADR 0004, 0013, 0017): one shared web ACL per
 * AWS account and Region, chosen in deploy.config.json (`webAcl`), because it's a fact about where the
 * site deploys, like the account itself:
 *
 * - the account's shared ACL ARN (deployed once per account and Region with auth-kit's
 *   `createSharedAuthWebAcl`; see auth-kit's README, "WAF: one web ACL for all your sites"): the preset
 *   only associates it with this pool. Its rule modes are set where it's created.
 * - `"own"`: a web ACL for this pool alone (about $7 a month), for a site alone in its account or the
 *   first one before the shared ACL exists. Its two per-IP rules: sign-in attempts (100 per 5 minutes)
 *   start in count mode (read a week of counts, then switch `signInRule` to 'block' below; auth-kit
 *   README, "Count first, then block the sign-in rule"), and all requests (1000) block from day one.
 * - `null`: not chosen yet. Sandboxes need no web ACL (auth-kit skips it there), so `npm run sandbox`
 *   works; a branch deploy fails synthesis with auth-kit's message until you choose.
 *
 * Turning WAF off entirely takes `waf: false` AND `acknowledgeNoRateLimit: true` in
 * amplify/auth/resource.ts: Cognito doesn't lock out wrong emailed codes, so "no rate limit" must be a
 * deliberate, visible choice.
 */
import { readFileSync } from 'node:fs';
import type { WafOptions } from 'auth-kit/amplify';

/** The pool's own web ACL's rule modes (`"own"`, and sandboxes that turn WAF on). */
export const OWN_WEB_ACL_RULES = { signInRule: 'count', overallRule: 'block' } as const satisfies WafOptions;

/** deploy.config.json's `webAcl`, as the preset's `waf` option. */
export function userPoolWaf(webAcl: string | null): WafOptions {
  if (webAcl === null) return { ...OWN_WEB_ACL_RULES };
  if (webAcl === 'own') return { ownWebAcl: true, ...OWN_WEB_ACL_RULES };
  return { webAclArn: webAcl };
}

/**
 * Reads `webAcl` from deploy.config.json (the preflight checks the whole file; auth-kit checks the ARN
 * again at synthesis). Read from disk rather than imported, so the backend's loader needs no JSON
 * import support.
 */
export function deployWebAcl(path: URL = new URL('../deploy.config.json', import.meta.url)): string | null {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as { webAcl?: unknown };
  const webAcl = raw.webAcl ?? null;
  if (webAcl !== null && typeof webAcl !== 'string') throw new Error('deploy.config.json: webAcl must be null, "own", or the account\'s shared web ACL ARN.');
  return webAcl;
}
