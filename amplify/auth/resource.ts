/**
 * The site's user pool: one pool per app, defined here and deployed by the branch pipeline (never
 * the console, never hand-edited). auth-kit's preset supplies the standard (03 §2): Cognito's own
 * sign-up always off (accounts are made on the server: an admin's invite, or the sign-up route on a
 * site whose `accountCreation` mode allows it); passkey first, then password + authenticator code,
 * then an emailed code as the backstop; MFA optional with TOTP only (the app requires an
 * authenticator of password users); passwords of 15+ characters with no composition rules; 60-minute
 * tokens and a 30-day refresh token on Tier 2; token revocation; PreventUserExistenceErrors; the
 * Essentials plan with SES email; deletion protection; tags; the site-wide role groups (owner,
 * superadmin, admin-content-people, admin-content, admin-view; auth-kit ADR 0020); and a WAF rate rule.
 *
 * Since auth-kit 0.1.8 (ADR 0023, 0024): the help address is required (`email.replyTo`, the Reply-To
 * on every auth email), the custom message trigger is required (it words the code emails and refuses
 * email changes made through Cognito's public API), the emailed code's lifetime is one setting
 * (`codeLifetimeMinutes`), and `accountCreation` decides how accounts get made. Each comes from
 * site.config.ts, which the app reads too, so the screens say what the pool does.
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
import { senderDisplayName } from 'auth-kit/themes';
import { takesSignUps } from '../../lib/account-modes';
import { site } from '../../site.config';
import { helpAddressFor } from '../../site.families';
import { customMessage } from './custom-message/resource';
import { preSignUp } from './pre-sign-up/resource';

export const authOptions = {
  project: site.project,
  owner: site.owner,
  tier: site.tier,
  // Cognito's own email comes from the family's sender name ("{Site} (UNC)" on a work site, or the site's name
  // on personal sites) with the help address as Reply-To; its words and layout come from the custom
  // message trigger below. The help address is required: the site's own, else its family's mailbox
  // (site.families.ts). The preset refuses a missing, placeholder, or personal address.
  email: {
    fromAddress: site.email.fromAddress,
    fromName: senderDisplayName(site.name, site.family),
    replyTo: helpAddressFor(site),
  },
  passkeys: site.passkeys,
  // App roles beyond the site-wide roles live in site.config.ts (the app reads them too).
  appRoles: site.appRoles,

  // How accounts get created (site.config.ts `accountCreation`; invite only by default) and how long an
  // emailed code works. The app passes the same values to the sign-in screens and the routes.
  accountCreation: site.accountCreation,
  codeLifetimeMinutes: site.codeLifetimeMinutes,
  // Sign-up sites: the site's own web ACL in front of the sign-up route (required in 'open' mode;
  // README, "Account creation"). Associate it with the Amplify app in Hosting → Firewall.
  ...(site.siteWaf !== null && takesSignUps(site.accountCreation) && { siteWebAclArn: site.siteWaf.webAclArn }),

  // ---- Rate limiting (auth-kit ADR 0004, 0013, 0017) ----------------------------------------
  // Default: the preset creates a web ACL for this pool (about $7/month) with two per-IP rules.
  // Each rule has its own mode. The sign-in rule (100 InitiateAuth/RespondToAuthChallenge per IP per
  // 5 minutes) starts in count mode: its header match is verified, but read about a week of its
  // counts first (auth-kit README, "Count first, then block the sign-in rule"), then set
  // signInRule: 'block'. The overall rule (1000 requests) blocks from day one, so the pool always has
  // a limit. These are the defaults, written out so the switch is one word:
  waf: { signInRule: 'count', overallRule: 'block' },
  //
  // Once you run more than one site in an AWS account and Region, share ONE web ACL instead: deploy
  // it once with `createSharedAuthWebAcl` from 'auth-kit/amplify' (a small CDK app of its own; see
  // auth-kit's README, "WAF: one web ACL for all your sites"), then point every site at it. The
  // shared ACL's rule modes are set in that app, not here
  // (`createSharedAuthWebAcl(stack, 'SharedAuthWebAcl', { waf: { signInRule: 'block' } })`):
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

// The custom message trigger on every pool (auth-kit requires it: amplify/auth/custom-message), and on
// 'domains' sites the preSignUp trigger that re-checks the domain list (amplify/auth/pre-sign-up).
export const auth = defineAuth(
  standardAuthProps(authOptions, {
    triggers: { customMessage, ...(site.accountCreation.mode === 'domains' && { preSignUp }) },
  }),
);
