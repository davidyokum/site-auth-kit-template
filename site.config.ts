/**
 * The site's identity: the one file to edit first when starting a new site from this template
 * (`npm run setup` asks the questions and writes the answers here).
 *
 * Plain data, because both halves of the project read it: the Next.js app (titles, sign-in screens,
 * emails) and the Amplify backend in `amplify/` (the pool, its triggers, the tables and jobs). Its
 * imports are site.families.ts (plain data too) and types from auth-kit; neither uses path aliases.
 *
 * Everything here is public (it ends up in the browser bundle or in AWS tags). Never put a secret,
 * an AWS account ID, or a pool ID here. Where to deploy lives in `deploy.config.json`.
 *
 * `npm run setup` rewrites single lines of this file (name, project, family, email.replyTo,
 * accountCreation, ownerEmail, alertEmails), and `npm run backdrop:pick` the `backdrop` line: keep
 * each of those on one line in the form it has here.
 */
import type { AccountCreationSettings } from 'auth-kit/accounts';
import type { BackdropStyleId } from 'auth-kit/backdrops';
import type { SiteFamily } from './site.families';

/**
 * The art behind the sign-in card, as stored. Locked: `{ style, seed, styleVersion, locked: true }`,
 * all literal (auth-kit ADR 0021). `npm run backdrop:pick` and `npm run backdrop:lock` write it.
 */
export interface SiteBackdrop {
  readonly style: BackdropStyleId;
  readonly seed?: string | number;
  readonly styleVersion?: number;
  readonly locked?: boolean;
}

/**
 * The CLOUDFRONT web ACL in front of the sign-up and request routes (auth-kit `createSiteWebAcl`:
 * a silent challenge and a per-IP limit), and AWS WAF's JavaScript integration for the pages that post
 * to them. README, "Account creation", says how to make both.
 */
export interface SiteWaf {
  /** `arn:aws:wafv2:us-east-1:<account>:global/webacl/<name>/<id>`: the preset's `siteWebAclArn`. */
  readonly webAclArn: string;
  /** The ACL's JavaScript integration URL, `https://<id>.edge.sdk.awswaf.com/<id>/<token>/challenge.js` (WAF console → Application integration). */
  readonly integrationUrl: string;
}

export const site = {
  /** Shown in titles, the sign-in screens, emails, and people's authenticator apps. */
  name: 'Example Site',

  /**
   * Who runs the site: one of the families in site.families.ts. Its auth-kit theme sets the card's
   * colors, the sender's display name, the footer identity line on the card and every email (none
   * on personal sites), the email hint, the help route, and the backdrop's palette. The template
   * ships 'personal'.
   */
  family: 'personal' as SiteFamily,

  /**
   * The art behind the sign-in card (auth-kit/backdrops). Choose it with `npm run backdrop:pick`
   * (nine variations behind the real card, locally; no AWS), which writes the literal choice here,
   * locked, with a backup in site.config.ts.bak. The site's name only proposes a default: with
   * `null` (no choice yet) local development draws that proposal, and production builds fail until
   * a backdrop is locked (`npm run backdrop:pick`, or `npm run backdrop:lock` to keep the proposal).
   * Locked, it never changes: not if the site is renamed, not across auth-kit upgrades.
   * Keep it on one line in this form; the picker rewrites exactly this line.
   */
  backdrop: null as SiteBackdrop | null,

  /**
   * The email field's example address on the sign-in screens (its placeholder; the "Email address"
   * label always shows). Null: the family's, e.g. "name@example.com". Set it when the people who
   * sign in use other addresses (outside partners on a work site).
   */
  emailHint: null as string | null,

  /** Slug for AWS tags and metric names: lowercase letters, digits, and hyphens. */
  project: 'example-site',

  /** The pool's `Owner` tag: a person or team who answers for this site. */
  owner: 'example-owner',

  /**
   * The owner's email address: the one person in the `owner` group (auth-kit ADR 0020; on David's
   * sites, David). The first owner account is made with it (README, "Deploy on Amplify", the owner
   * step). Null in the template.
   */
  ownerEmail: null as string | null,

  /**
   * The person the help screens name on the work families' sites ("Jordan Lee looks after Example Site").
   * Personal sites say "the Example Site team" and never show a person's name, so it stays null here.
   */
  ownerName: null as string | null,

  /**
   * 2 = named people (the default: any site with a login).
   * 3 = sensitive (PII, personnel data, survey responses): shorter sessions and sign-in event logs.
   * Changing this also changes `amplify/auth/resource.ts` behavior; read the README's "Tier 3" first.
   */
  tier: 2,

  /**
   * Auth email (emailed codes, invites, alerts) goes through Amazon SES from `fromAddress`. Its domain
   * must be a verified SES identity in the AWS account you deploy to, with SPF, DKIM, and DMARC
   * published. The sender's display name comes from `name` and `family`.
   *
   * `replyTo` is the site's HELP ADDRESS (required; auth-kit ADR 0024): a role-based mailbox, never a
   * person's own address. It's the Reply-To on every auth email (Cognito's code emails included),
   * the "Help: …" line at the foot of every email, and the address the sign-in card's help screens
   * name. Null: the family's mailbox (site.families.ts; personal sites: help@yokumlab.com).
   * A site with a mailbox of its own sets it here, e.g.:
   *   replyTo: 'reports-help@example.org' as string | null,
   * A Super admin can change it without a deploy: Admin → Settings → "Sign-in help" (needs a recent
   * sign-in and a reason; audited; the owner and every Super admin are emailed, and the change is
   * undone if that email can't be sent). It stays on this address's domain (or the family's).
   */
  email: {
    fromAddress: 'noreply@example.com',
    replyTo: null as string | null,
  },

  /**
   * How people get an account (register D1; auth-kit ADR 0023). Cognito's own sign-up stays off in
   * every mode: accounts are made on the server, the way an invite makes them, and every new account
   * starts as Member. The sign-in card says which mode applies.
   *
   *   { mode: 'invite' }  Invite only (the default). An admin invites from the People page; a
   *       project's Manager invites someone to that project. Nothing else to set up.
   *
   *   { mode: 'request' }  Request access. Anyone can ask (/request-access: name, email, why); an
   *       admin approves (the ordinary invite) or declines on the People page's "Pending requests"
   *       tab, and admins who manage people get a daily digest. The backend adds the request and
   *       rate-limit tables and the digest job; set `privacyNoticeUrl`.
   *
   *   { mode: 'domains', domains: ['example.org'], requestsAlso: true }  Sign-up for approved
   *       domains. Addresses on the list create their own account (/sign-up); with requestsAlso,
   *       everyone else can request access. A domain also takes its subdomains, and a bare top-level
   *       domain ('edu') takes every address under it, students and alumni included: say so on purpose.
   *       The backend adds the preSignUp trigger (it re-checks the list), the rate-limit table, and
   *       the 24-hour cleanup of never-verified sign-ups; set `privacyNoticeUrl`. `siteWaf` is optional.
   *
   *   { mode: 'open' }  Open sign-up: anyone with an email address (public profiles, say). Needs
   *       everything 'domains' needs, plus `siteWaf` (required: the build fails without it) and the
   *       WAF smoke test after every deploy (`npm run waf:smoke -- --url https://<site>`).
   *
   * Members on sign-up sites ('domains', 'open') change their own email and delete their own account
   * from My account. Keep it on one line; `npm run setup` rewrites it.
   */
  accountCreation: { mode: 'invite' } as AccountCreationSettings,

  /**
   * How long an emailed code works, in minutes (register A7): the pool's sign-in session, and every
   * screen and email that says it. auth-kit's default is 3; Cognito allows 3 to 15.
   */
  codeLifetimeMinutes: 3,

  /**
   * Sign-up and request sites: the privacy notice (what the site keeps about people, and why),
   * linked from the sign-up and request screens (register D4). A site path ('/privacy') or an
   * https URL. Required on sign-up sites ('domains', 'open'). Null on invite-only sites.
   */
  privacyNoticeUrl: null as string | null,

  /** Open sign-up sites with terms: "By creating an account you agree to the terms and privacy notice." Null: no terms. */
  termsUrl: null as string | null,

  /**
   * The site's own web ACL in front of the sign-up and request routes, and its JavaScript
   * integration. Required in 'open' mode, optional in 'domains' mode, unused otherwise (README,
   * "Account creation"). Null until you make one.
   */
  siteWaf: null as SiteWaf | null,

  /**
   * App roles: groups beyond the site-wide roles (owner, superadmin, admin-content-people,
   * admin-content, admin-view; auth-kit ADR 0020), e.g. ['reviewer'].
   * Each one needs capabilities in lib/capabilities.ts and a persona in personas.json.
   */
  appRoles: [] as readonly string[],

  /**
   * Email domains invites normally go to. An invite outside them needs an extra confirmation,
   * because an invite to a mistyped address is a live account for whoever owns that inbox.
   */
  inviteDomains: ['example.com'],

  /**
   * Named people who get an email whenever someone's role is granted or removed, or an account is
   * disabled or deleted (03 §2: "grants and removals alert a named person"). The owner also gets
   * auth-kit's own alert whenever someone is made Super admin, and both owners when ownership moves.
   * The first address is also warned when the owner's invite goes unused (amplify/backend.ts).
   * Empty: the alert is only logged. `npm run setup` puts the owner's address here.
   */
  alertEmails: [] as readonly string[],

  /**
   * Passkeys switch on once the site's final custom domain is live: they're bound to it, and
   * changing it later forces everyone to register again. Until then: `false`.
   * Later: `{ relyingPartyId: 'www.example.com' }`. The sign-in card then also passes it to auth-kit
   * (`passkey={{ relyingPartyId }}`), so the passkey window looks the same for every address.
   */
  passkeys: false as false | { relyingPartyId: string },

  /**
   * Local development: `http://<app>.localhost:<port>`. One *.localhost name per app, because
   * cookies ignore ports (two apps on localhost:3000 and :3001 would share sessions).
   * If you change these, change the `dev` and `start` scripts in package.json to match.
   */
  dev: {
    app: 'app',
    port: 3000,
  },
} as const;

/** The local development origin, e.g. `http://app.localhost:3000`. */
export const devOrigin = `http://${site.dev.app}.localhost:${site.dev.port}`;
