/**
 * The account-change notice route (auth-kit `createAccountNoticeRoute`, lib/accounts.ts; register A10,
 * on by default): after a new passkey or a changed password, auth-kit's screens (`SignIn`, `SignUp`,
 * `MyAccount`, and the chooser) post `{ "event": "passkey-added" | "password-changed" }` here, and say
 * "We've emailed you a note about this." only when it answered yes. Cognito has no trigger for either
 * change, so the browser asks.
 *
 * Signed-in people only: auth-kit's route checks the session itself (`auth.requireUser`, letting in an
 * account that has just chosen its first credential), emails only that account's own address, checks
 * a passkey notice against the account's passkeys, and is limited per account. The path is auth-kit's
 * `ACCOUNT_NOTICE_PATH`, where the screens post by default.
 */
import { assertSameOrigin, withAuthErrors } from 'auth-kit/server';
import { accountNotices } from '@/lib/accounts';
import { expectedOrigin } from '@/lib/origin';

export const POST = withAuthErrors(async (request: Request) => {
  // A post from any other origin is refused before anything else (403 origin_mismatch).
  assertSameOrigin(request, { expectedOrigin: expectedOrigin() });
  return accountNotices().POST(request);
});
