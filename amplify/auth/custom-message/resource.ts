/**
 * Cognito's custom message trigger (auth-kit ADR 0023, 0024). Every pool needs it, and auth-kit's
 * preset fails synthesis without it:
 *
 * - **A security control.** It refuses an email change made through Cognito's public API (a signed-in
 *   person's own `UpdateUserAttributes`), which would skip the site's recent-sign-in check, its
 *   domain list, its audit log, and its notice to the old address. Changes go through the site's
 *   server (My account on sign-up sites) or an admin.
 * - **The code emails' words.** Cognito's sign-in code, the first code of a sign-up, the password
 *   reset, and the code to a new address, in the approved words and the family's look: no letterhead,
 *   the code first, "Only enter codes at {domain}", and the card's footer ("Help: {address}.").
 *
 * `CUSTOM_MESSAGE_GATE_ENV` is the marker the preset looks for on this function (the sign that it's
 * built with auth-kit's `customMessageHandler`). The function runs in the auth stack
 * (`resourceGroupName: 'auth'`), as Amplify asks of auth triggers.
 *
 * The site's address is read at synthesis (lib/origin.ts `backendOrigin`: the branch's custom domain
 * or default Amplify address; your sandbox's local origin), so the code emails can name the domain
 * codes belong on.
 */
import { defineFunction } from '@aws-amplify/backend';
import { CUSTOM_MESSAGE_GATE_ENV } from 'auth-kit/amplify';
import { backendOrigin } from '../../../lib/origin';

export const customMessage = defineFunction({
  name: 'custom-message',
  entry: './handler.ts',
  runtime: 22,
  resourceGroupName: 'auth',
  environment: { ...CUSTOM_MESSAGE_GATE_ENV, SITE_SIGN_IN_URL: `${backendOrigin()}/sign-in` },
});
