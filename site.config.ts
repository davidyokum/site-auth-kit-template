/**
 * The site's identity: the one file to edit first when starting a new site from this template.
 *
 * Pure data with no imports, because both halves of the project read it: the Next.js app (titles,
 * sign-in screens, invite emails) and the Amplify backend in `amplify/` (pool tags, sender address).
 *
 * Everything here is public (it ends up in the browser bundle or in AWS tags). Never put a secret,
 * an AWS account ID, or a pool ID here. Where to deploy lives in `deploy.config.json`.
 */
export const site = {
  /** Shown in titles, the sign-in screens, invite emails, and people's authenticator apps. */
  name: 'Example Site',

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
   * Auth email (emailed codes, invites) goes through Amazon SES from this address. Its domain must be
   * a verified SES identity in the AWS account you deploy to, with SPF, DKIM, and DMARC published.
   */
  email: {
    fromAddress: 'noreply@example.com',
    fromName: 'Example Site',
  },

  /**
   * App roles: groups beyond superadmin (Owner), admin, editor, and viewer, e.g. ['reviewer'].
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
   * disabled or deleted (03 §2: "grants and removals alert a named person"). Owners also get
   * auth-kit's own alert whenever someone is made an owner. Empty: the alert is only logged.
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
