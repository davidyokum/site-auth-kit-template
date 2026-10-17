/**
 * Which AWS account IDs and Amplify app IDs the repo may contain (test/unit/hygiene.test.ts).
 *
 * The public template holds only obviously fake placeholders. A real site started from it also
 * holds its own account ID and Amplify app ID in deploy.config.json (`awsAccountId`, `amplifyAppId`),
 * so those two are allowed as well, and nothing else: any other ID-shaped string still fails.
 * Pure (no I/O), so its own tests feed it fake configs and fake file contents.
 */
import { AMPLIFY_APP_ID_RE, PLACEHOLDER_ACCOUNT_ID } from '../../../scripts/lib/deploy-config.mjs';

/** Obviously fake account IDs used in docs and tests (the first is deploy.config.json's placeholder). */
export const FAKE_ACCOUNT_IDS: ReadonlySet<string> = new Set([PLACEHOLDER_ACCOUNT_ID, '111122223333', '444455556666']);

/** Obviously fake Amplify app IDs used in tests. */
export const FAKE_APP_IDS: ReadonlySet<string> = new Set(['d1111222233334', 'd4444555566667']);

/** A 12-digit number on its own (not part of a longer number or a decimal). */
const ACCOUNT_ID = /(?<![\d.])\d{12}(?![\d.])/g;

/** Amplify's app-ID shape with at least one digit, so ordinary 14-letter words don't count. */
const APP_ID = /\bd(?=[a-z0-9]*\d)[a-z0-9]{13}\b/g;

export interface AllowedIds {
  accounts: ReadonlySet<string>;
  appIds: ReadonlySet<string>;
}

const FAKES: AllowedIds = { accounts: FAKE_ACCOUNT_IDS, appIds: FAKE_APP_IDS };

/**
 * The fakes plus the site's own IDs from deploy.config.json (its parsed JSON). An ID is added only
 * when it has the right shape and isn't the placeholder, so the template's config adds nothing.
 */
export function allowedIds(deployConfig: unknown, fakes: AllowedIds = FAKES): AllowedIds {
  const accounts = new Set(fakes.accounts);
  const appIds = new Set(fakes.appIds);
  const config = (typeof deployConfig === 'object' && deployConfig !== null ? deployConfig : {}) as Record<string, unknown>;
  const { awsAccountId, amplifyAppId } = config;
  if (typeof awsAccountId === 'string' && /^\d{12}$/.test(awsAccountId) && awsAccountId !== PLACEHOLDER_ACCOUNT_ID) accounts.add(awsAccountId);
  if (typeof amplifyAppId === 'string' && AMPLIFY_APP_ID_RE.test(amplifyAppId)) appIds.add(amplifyAppId);
  return { accounts, appIds };
}

/** The account IDs and app IDs in `text` that aren't allowed. */
export function unknownIds(text: string, allowed: AllowedIds): { accounts: string[]; appIds: string[] } {
  return {
    accounts: [...text.matchAll(ACCOUNT_ID)].map((m) => m[0]).filter((id) => !allowed.accounts.has(id)),
    appIds: [...text.matchAll(APP_ID)].map((m) => m[0]).filter((id) => !allowed.appIds.has(id)),
  };
}
