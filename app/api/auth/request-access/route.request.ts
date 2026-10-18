/**
 * The request-access route (auth-kit `createAccountCreationRoutes`, lib/accounts.ts). Only on request
 * sites (the `.request.ts` extension; next.config.ts). Public by design: rate-limited, one pending
 * request per address, at most 100 new a day, and the same answer for every address, in at least
 * 800 ms. A request is a row in the request table, never a Cognito user.
 */
import { assertSameOrigin, withAuthErrors } from 'auth-kit/server';
import { accountRoutes } from '@/lib/accounts';
import { expectedOrigin } from '@/lib/origin';

export const POST = withAuthErrors(async (request: Request) => {
  assertSameOrigin(request, { expectedOrigin: expectedOrigin() });
  return accountRoutes().requestAccess(request);
});
