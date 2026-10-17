/**
 * The site's user pool: one pool per app, defined here and deployed by the branch pipeline (never
 * the console, never hand-edited). auth-kit's preset supplies the standard (03 §2): invite-only,
 * passkey first, then password + authenticator code, then an emailed code as the backstop;
 * MFA optional with TOTP only (the app requires an authenticator of password users); passwords of
 * 15+ characters with no composition rules; 60-minute tokens and a 30-day refresh token on Tier 2;
 * token revocation; PreventUserExistenceErrors; the Essentials plan with SES email; deletion
 * protection; tags; the groups superadmin (Owner), admin, editor, viewer; and a WAF rate rule.
 *
 * Amplify fails synthesis unless `defineAuth` is called directly from this file, so the preset
 * returns props for this call; settings `defineAuth` can't express are applied in `backend.ts`
 * by `applyAuthStandard` (auth-kit ADR 0006).
 *
 * Sandboxes (`npm run sandbox`) are detected automatically: they're tagged `Environment=sandbox`,
 * skip deletion protection (so `ampx sandbox delete` works) and the billed web ACL, and only their
 * app client gets ADMIN_USER_PASSWORD_AUTH, which the localhost "Sign in as…" route needs.
 */
import { defineAuth } from '@aws-amplify/backend';
import { standardAuthProps, type AuthStandardOptions } from 'auth-kit/amplify';
import { site } from '../../site.config';

export const authOptions = {
  project: site.project,
  owner: site.owner,
  tier: site.tier,
  email: site.email,
  passkeys: site.passkeys,
  // App roles beyond superadmin/admin/editor/viewer live in site.config.ts (the app reads them too).
  appRoles: site.appRoles,

  // ---- Rate limiting (auth-kit ADR 0004, 0013) ----------------------------------------------
  // Default: the preset creates a web ACL for this pool (about $7/month). Once you run more than
  // one site in an AWS account and Region, share ONE web ACL instead: deploy it once with
  // `createSharedAuthWebAcl` from 'auth-kit/amplify' (a small CDK app of its own; see auth-kit's
  // README, "WAF: one web ACL for all your sites"), then point every site at it:
  //
  // waf: { webAclArn: 'arn:aws:wafv2:<region>:<account-id>:regional/webacl/auth-kit-shared-user-pools/<id>' },
  //
  // Turning WAF off entirely takes `waf: false` AND `acknowledgeNoRateLimit: true`: Cognito doesn't
  // lock out wrong emailed codes, so "no rate limit" must be a deliberate, visible choice.

  // ---- Tier 3 (sensitive data) ----------------------------------------------------------------
  // Set `tier: 3` in site.config.ts. The preset then caps the refresh token at 1 day and turns on
  // Cognito threat protection in audit mode (sign-in event logs; Plus plan). The standard also
  // wants admins on a SEPARATE admin pool (its own Amplify backend: MFA required, no emailed codes,
  // passkeys): there, set `adminPool: true` and use `inviteMode: 'temporary-password'` in
  // lib/admin.ts. Tier 3 also needs a private database, a reviewed audit log, and a quarterly
  // access review (README, "Tier 3").
  //
  // tier: 3,
  // threatProtection: 'audit', // or 'enforced' once you've watched the logs
  // refreshTokenMinutes: 24 * 60,
} satisfies AuthStandardOptions;

export const auth = defineAuth(standardAuthProps(authOptions));
