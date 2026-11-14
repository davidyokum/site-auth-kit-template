// `npm run deploy`'s pure half: the `auth-kit deploy` command for this site, from site.config.ts and
// deploy.config.json, and what has to be true first. No I/O here, so the unit tests cover it.
import { backdropLockProblems } from 'auth-kit/backdrops';

/**
 * Why this site can't deploy yet ([] when it can): each is something setup or the owner settles.
 * @param {{ name: string, backdrop: unknown, passkeys: unknown, ownerEmail: unknown }} site
 * @param {{ repo: string | null, webAcl: string | null }} config
 */
export function deployBlockers(site, config) {
  const blockers = [];
  if (typeof site.passkeys !== 'object' || site.passkeys === null) blockers.push("site.config.ts has no address (passkeys: false): run npm run setup and give the owner's answer for the site's address.");
  if (backdropLockProblems(site.backdrop).length > 0 || /** @type {{ chosen?: unknown } | null} */ (site.backdrop)?.chosen !== 'owner') {
    blockers.push("The backdrop isn't the owner's choice yet: npm run backdrop:pick with them (or npm run backdrop:set -- <style>:<seed>:<version> --owner-chose once they've named one).");
  }
  if (typeof site.ownerEmail !== 'string' || !site.ownerEmail) blockers.push("site.config.ts has no ownerEmail: run npm run setup.");
  if (!config.repo) blockers.push('deploy.config.json has no repo: set it to the GitHub repository, owner/name (deploy makes it, private, if it doesn’t exist).');
  if (!config.webAcl) blockers.push('deploy.config.json has no webAcl: choose the account’s shared web ACL (README, "The user pool\'s web ACL").');
  return blockers;
}

/**
 * The arguments for `npx --no-install auth-kit deploy`.
 * @param {{ name: string, family: string, ownerEmail: string, passkeys: { relyingPartyId: string }, email?: { replyTo?: unknown } }} site
 * @param {Record<string, string | null>} familyHelpMailbox
 * @param {{ repo: string }} config
 * @param {string[]} passthrough  e.g. ['--yes'] or ['--wait-for-domain', '30']
 */
export function deployArgs(site, familyHelpMailbox, config, passthrough = []) {
  const replyTo = site.email?.replyTo;
  const help = replyTo !== null && typeof replyTo === 'object' ? /** @type {{ address: string }} */ (replyTo).address : typeof replyTo === 'string' && replyTo ? replyTo : familyHelpMailbox[site.family];
  if (!help) throw new Error('No help address: set email.replyTo in site.config.ts (npm run setup).');
  for (const arg of passthrough) {
    if (/^--(repo|domain|owner-email|site-name|family|help-address)(=|$)/.test(arg)) throw new Error(`Don't pass ${arg.split('=')[0]}: npm run deploy takes it from site.config.ts and deploy.config.json.`);
  }
  return [
    '--no-install', 'auth-kit', 'deploy',
    '--repo', config.repo,
    '--domain', site.passkeys.relyingPartyId,
    '--owner-email', site.ownerEmail,
    '--site-name', site.name,
    '--family', site.family,
    '--help-address', help,
    ...passthrough,
  ];
}
