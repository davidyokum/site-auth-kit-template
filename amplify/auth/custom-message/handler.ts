/**
 * The custom message trigger's code: auth-kit's `customMessageHandler` as is (amplify/auth/custom-
 * message/resource.ts says why every pool has it). Site wording of your own? Wrap it instead with
 * `withAuthKitCustomMessage` from the same module, which keeps the refusal of public-API email changes.
 */
import { customMessageHandler } from 'auth-kit/amplify/custom-message';
import { site } from '../../../site.config';
import { helpAddressFor } from '../../../site.families';
import { siteTheme } from '../../../lib/theme';

export const handler = customMessageHandler({
  siteName: site.name,
  theme: siteTheme(site),
  // Set at synthesis (resource.ts): https://<the site>/sign-in. Its host is the "Only enter codes at" domain.
  signInUrl: process.env.SITE_SIGN_IN_URL ?? '',
  // The configured help address. A Super admin's override reaches the app's own emails and screens
  // at once, and Cognito's code emails on the next deploy (auth-kit ADR 0024).
  helpEmail: helpAddressFor(site),
  codeLifetimeMinutes: site.codeLifetimeMinutes,
});
