/**
 * How people get an account here, and look after their own, and where they go for help (auth-kit
 * `auth-kit/accounts`; ADR 0023, 0024). Server-only.
 *
 * - `signInHelp()`: the help address in effect (the configured one, or a Super admin's override from
 *   the site settings table). The sign-in page, the help screens, and every email read it.
 * - `signInHelpActions()`: Admin → Settings → "Sign-in help" (a Super admin changes the address
 *   without a deploy; recent sign-in, a reason, audited, the owner and every Super admin emailed).
 * - `accountRoutes()`: the sign-up and request routes, on sites whose `accountCreation` mode takes
 *   them (lib/account-modes.ts). Same answer for every address, rate limits, at least 800 ms.
 * - `selfService()`: on sign-up sites, members change their own email and delete their own account.
 * - `accessRequests()`: the request queue (request sites), for the People page's "Pending requests".
 *
 * Each is made on first use, not at import: building them needs the public origin, which a
 * production build doesn't have until it runs on its branch, and the tables from amplify_outputs.json.
 * Under the auth-matrix dev server only, the stores are auth-kit's in-memory ones and no email is sent.
 */
import 'server-only';
import {
  type AccessRequestStore,
  type AccountCreationRoutes,
  createAccountCreationRoutes,
  createDynamoAccessRequestStore,
  createDynamoRateLimitStore,
  createDynamoSiteSettingsStore,
  createMemoryAccessRequestStore,
  createMemoryRateLimitStore,
  createMemorySiteSettingsStore,
  createSelfServiceActions,
  createSignInHelp,
  createSignInHelpActions,
  type EffectiveSignInHelp,
  forwardedForClientIp,
  type RateLimitStore,
  type SelfServiceActions,
  type SignInHelp,
  type SignInHelpActions,
  type SiteSettingsStore,
} from 'auth-kit/accounts';
import type { EmailSender } from 'auth-kit/admin';
import { after } from 'next/server';
import { matrixOverrides } from '@/dev-matrix';
import { site } from '@/site.config';
import { helpAddressFor } from '@/site.families';
import { needsRateLimits, takesRequests, takesSignUps } from './account-modes';
import { auditLog } from './audit-log';
import { auth } from './auth';
import { createSiteMailer, type SiteMailer } from './email';
import { expectedOrigin, publicOrigin } from './origin';
import { outputs } from './outputs';
import { resourceActions } from './resource-actions';
import { siteTheme } from './theme';

const report = (context: string) => (error: unknown) => console.error(`[accounts] ${context}:`, error instanceof Error ? error.message : error);

/** A store whose table isn't in amplify_outputs.json: every call fails with the reason, never a silent stand-in. */
function missingSettingsStore(reason: string): SiteSettingsStore {
  const fail = () => Promise.reject(new Error(reason));
  return { get: fail, put: fail, remove: fail };
}

const tableMissing = (key: string, what: string) =>
  `No ${what} table in amplify_outputs.json (custom.${key}). Deploy the backend: \`npm run sandbox\` locally, or the branch pipeline on Amplify.`;

let help: SignInHelp | undefined;

/** The help address in effect (never throws: falls back to the configured address). */
export function signInHelp(): SignInHelp {
  if (help) return help;
  const matrix = matrixOverrides();
  let store: SiteSettingsStore;
  if (matrix) store = matrix.shared('site-settings', createMemorySiteSettingsStore);
  else if (outputs.custom?.siteSettingsTable) store = createDynamoSiteSettingsStore({ tableName: outputs.custom.siteSettingsTable, region: outputs.auth.aws_region });
  else store = missingSettingsStore(tableMissing('siteSettingsTable', 'site settings'));
  return (help = createSignInHelp({ configured: helpAddressFor(site), theme: site.family, store, onError: report('sign-in help setting') }));
}

/** For pages: the address in effect, or the configured one if the setting couldn't be read. */
export async function effectiveHelp(): Promise<EffectiveSignInHelp> {
  return signInHelp().effective();
}

let mailer: SiteMailer | undefined;

/** The site's mailer (lib/email.ts) with the help address in effect. Under the matrix, nothing is ever sent. */
export function accountMailer(): SiteMailer | EmailSender {
  const matrix = matrixOverrides();
  if (matrix) return { sendEmail: () => Promise.reject(new Error('The auth-matrix server sends no email.')) };
  return (mailer ??= createSiteMailer({ region: outputs.auth.aws_region, help: signInHelp(), signInUrl: `${publicOrigin()}/sign-in` }));
}

let helpActions: SignInHelpActions | undefined;

/** Admin → Settings → "Sign-in help". */
export function signInHelpActions(): SignInHelpActions {
  if (helpActions) return helpActions;
  const matrix = matrixOverrides();
  helpActions = createSignInHelpActions({
    auth,
    auditLog: auditLog(),
    help: signInHelp(),
    siteName: site.name,
    // The owner and every Super admin are emailed about each change; if that can't be sent, it's undone.
    ...(matrix ? {} : { ownerAlerts: accountMailer() as SiteMailer }),
    ...(matrix && { cognito: matrix.peopleCognito }),
    onError: (error, context) => report(context)(error),
  });
  return helpActions;
}

let rateLimitStore: RateLimitStore | undefined;

function rateLimits(): RateLimitStore {
  if (rateLimitStore) return rateLimitStore;
  const matrix = matrixOverrides();
  if (matrix) return (rateLimitStore = matrix.shared('rate-limits', createMemoryRateLimitStore));
  const tableName = outputs.custom?.rateLimitTable;
  if (!tableName) throw new Error(tableMissing('rateLimitTable', 'rate-limit'));
  return (rateLimitStore = createDynamoRateLimitStore({ tableName, region: outputs.auth.aws_region }));
}

let requestStore: AccessRequestStore | undefined;

/** The request queue, on sites that take requests; null elsewhere. */
export function accessRequests(): AccessRequestStore | null {
  if (!takesRequests(site.accountCreation)) return null;
  if (requestStore) return requestStore;
  const matrix = matrixOverrides();
  if (matrix) return (requestStore = matrix.shared('access-requests', createMemoryAccessRequestStore));
  const tableName = outputs.custom?.accessRequestTable;
  if (!tableName) throw new Error(tableMissing('accessRequestTable', 'access request'));
  return (requestStore = createDynamoAccessRequestStore({ tableName, region: outputs.auth.aws_region }));
}

/**
 * Under the auth matrix only: limits high enough for every persona to send each row twice. The real
 * limits (auth-kit's `ACCOUNT_CREATION_POLICY`) are auth-kit's to test; the matrix tests who gets in.
 */
const MATRIX_RATE_LIMITS = Object.fromEntries(
  (['signUpPerAddress', 'signUpPerIp', 'signUpSite', 'requestPerAddress', 'requestPerIp', 'requestSite'] as const).map((rule) => [rule, { limit: 10_000, windowMinutes: 60 }]),
);

let routes: AccountCreationRoutes | undefined;

/** The sign-up and request routes. Only sites that take sign-ups or requests have them (their route files exist only there). */
export function accountRoutes(): AccountCreationRoutes {
  if (routes) return routes;
  if (!needsRateLimits(site.accountCreation)) throw new Error(`site.config.ts: accountCreation mode '${site.accountCreation.mode}' has no sign-up or request routes.`);
  const matrix = matrixOverrides();
  const requests = accessRequests();
  const origin = expectedOrigin();
  routes = createAccountCreationRoutes({
    accountCreation: site.accountCreation,
    siteName: site.name,
    theme: siteTheme(site),
    signInUrl: `${publicOrigin()}/sign-in`,
    help: signInHelp(),
    pool: { userPoolId: outputs.auth.user_pool_id, region: outputs.auth.aws_region },
    auditLog: auditLog(),
    mailer: accountMailer(),
    rateLimits: rateLimits(),
    ...(requests && { requests }),
    ...(origin !== undefined && { allowedOrigins: [origin] }),
    // Behind Amplify Hosting, the last X-Forwarded-For entry (the one CloudFront appended). Never the
    // first, which the client writes. (auth-kit ADR 0023: confirm on the first deploy.)
    clientIp: forwardedForClientIp(),
    // Open sign-up refuses requests without AWS WAF's token (the site web ACL's challenge); local
    // development has no WAF in front of it.
    ...(process.env.NODE_ENV === 'development' && { requireWafToken: false }),
    // "You already have an account" goes out after the answer, so SES's speed can't tell a new address from an existing one.
    background: (task) => after(() => task),
    ...(matrix && { cognito: matrix.peopleCognito, rateLimitRules: MATRIX_RATE_LIMITS }),
    onError: (error, context) => report(context)(error),
  });
  return routes;
}

let self: SelfServiceActions | undefined;

/** Members' own email change and account deletion (sign-up sites; refused elsewhere). */
export function selfService(): SelfServiceActions {
  if (self) return self;
  const matrix = matrixOverrides();
  self = createSelfServiceActions({
    auth,
    auditLog: auditLog(),
    accountCreation: site.accountCreation,
    siteName: site.name,
    signInUrl: `${publicOrigin()}/sign-in`,
    theme: siteTheme(site),
    help: signInHelp(),
    mailer: accountMailer(),
    // Only sign-up sites offer these (and have the table); elsewhere the actions refuse before counting.
    rateLimits: takesSignUps(site.accountCreation) ? rateLimits() : { hit: () => Promise.reject(new Error('This site takes no sign-ups.')) },
    // Their roles on projects go before the account does.
    removeResourceMemberships: (person) => resourceActions().removeResourceMemberships(person),
    itemsNote: 'Your roles on projects are removed; the projects themselves stay with their other Managers.',
    ...(matrix && { cognito: matrix.peopleCognito }),
    onError: (error, context) => report(context)(error),
  });
  return self;
}
