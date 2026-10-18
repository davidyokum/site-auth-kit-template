/**
 * The site's identity: the one file to edit first when starting a new site from this template.
 *
 * Plain data, because both halves of the project read it: the Next.js app (titles, sign-in screens,
 * invite emails) and the Amplify backend in `amplify/` (pool tags, sender address). Its imports are
 * site.families.ts (plain data too) and one type from auth-kit; neither uses path aliases.
 *
 * Everything here is public (it ends up in the browser bundle or in AWS tags). Never put a secret,
 * an AWS account ID, or a pool ID here. Where to deploy lives in `deploy.config.json`.
 */
import type { BackdropStyleId } from 'auth-kit/backdrops';
import type { SiteFamily } from './site.families';

/**
 * The art behind the sign-in card, as stored. Locked: `{ style, seed, styleVersion, locked: true }`,
 * all literal (auth-kit ADR 0020). `npm run backdrop:pick` and `npm run backdrop:lock` write it.
 */
export interface SiteBackdrop {
  readonly style: BackdropStyleId;
  readonly seed?: string | number;
  readonly styleVersion?: number;
  readonly locked?: boolean;
}

export const site = {
  /** Shown in titles, the sign-in screens, invite emails, and people's authenticator apps. */
  name: 'Example Site',

  /**
   * Who runs the site: one of the families in site.families.ts ('personal' is Yokum Lab). It sets
   * the sender's display name on all auth email (the site's name, plus the family's short name for
   * the work families), the footer of the email the site sends, and the sign-in card's owner line,
   * colors, and email hint, and the backdrop's palette. The template ships 'personal'.
   */
  family: 'personal' as SiteFamily,

  /** UNC only: the unit, as in "A UNC-Chapel Hill {unit} project". Null: "A UNC-Chapel Hill project." */
  familyUnit: null as string | null,

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
   * `replyTo`: the family's help mailbox. Auth email carries it as Reply-To (Cognito's code emails,
   * invites, alerts), and the site's own email names it in the footer ("Help: …"). Null: no Reply-To
   * and no help line; set one before real people get email, so replies don't go to `fromAddress`.
   */
  email: {
    fromAddress: 'noreply@example.com',
    replyTo: null as string | null,
  },

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
   * Empty: the alert is only logged.
   */
  alertEmails: [] as readonly string[],

  /**
   * Passkeys switch on once the site's final custom domain is live: they're bound to it, and
   * changing it later forces everyone to register again. Until then: `false`.
   * Later: `{ relyingPartyId: 'www.example.com' }`.
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
