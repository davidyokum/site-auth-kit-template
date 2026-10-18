/**
 * The sign-up route (auth-kit `createAccountCreationRoutes`, lib/accounts.ts): a self-invite. Only on
 * sign-up sites (the `.signup.ts` extension; next.config.ts). Public by design: it checks the address
 * (and the domain list), rate-limits per mailbox, per IP, and site-wide, and either makes the account
 * the way an invite does (no password, no group: a Member) or emails "You already have an account".
 * Every answer is the same and takes at least 800 ms. Cognito's own SignUp stays off.
 */
import { assertSameOrigin, withAuthErrors } from 'auth-kit/server';
import { accountRoutes } from '@/lib/accounts';
import { expectedOrigin } from '@/lib/origin';

export const POST = withAuthErrors(async (request: Request) => {
  // A post from any other origin is refused before anything else (403 origin_mismatch).
  assertSameOrigin(request, { expectedOrigin: expectedOrigin() });
  return accountRoutes().signUp(request);
});
