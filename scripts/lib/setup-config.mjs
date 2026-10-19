// `npm run setup`'s pure half: check the answers, and rewrite site.config.ts and personas.json with
// them. No I/O here, so the unit tests cover every rule.
//
// What setup asks, and where each answer goes (site.config.ts unless noted):
//   site name              name, project (a slug of it), and personas.json's .test domain
//   family                 family (one of site.families.ts's)
//   sender                 email.fromAddress (null when it's the family's shared sender)
//   help mailbox           email.replyTo (null when it's the family's own mailbox; a person's own
//                          address only acknowledged, { address, personal: true }: register E4c)
//   account creation       accountCreation (+ privacyNoticeUrl on sign-up sites)
//   owner's email          ownerEmail, alertEmails, and inviteDomains (its domain) while that's the template's
//   owner's name           ownerName (work families only: their help screens name the owner)
//
// Not asked: the card style (site.config.ts `cardStyle`, Quiet by default; register E5), the code
// lifetime (10 minutes, register A7), and the site web ACL a sign-up site needs (`siteWaf`: it has to
// exist in AWS first, so setup names it as a next step).
//
// Every value is public (it reaches the browser or AWS tags). Setup never asks for, or writes, a
// password, a key, a token, or an AWS account ID.
import { helpAddressProblems, senderAddressProblems } from 'auth-kit/themes';

export const MODES = ['invite', 'request', 'domains', 'open'];

// The families come from site.families.ts (passed in as `context`), the one file that names them.

const EMAIL_RE = /^[^\s@<>"(),;:]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

/** "Budget Reports 2027" → "budget-reports-2027": lowercase letters, digits, and hyphens. */
export function slugify(name) {
  return String(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
}

/** A single-quoted TypeScript string literal. */
export function tsString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** A site path ('/privacy') or an https URL, as auth-kit's screens accept for a link. */
function isLink(value) {
  if (/^\/(?!\/)\S*$/.test(value)) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Checks and normalizes the answers. Returns `{ answers, problems }`; write nothing while there are problems.
 * @param {{ name?: string, family?: string, sender?: string, help?: string, helpPersonal?: boolean, mode?: string, domains?: string[] | string, requestsAlso?: boolean, privacyNoticeUrl?: string | null, ownerEmail?: string, ownerName?: string | null }} raw
 * @param {{ familyHelpMailbox: Record<string, string | null>, familySender: Record<string, string | null>, families: readonly string[], namesOwner: Record<string, boolean> }} context
 */
export function checkAnswers(raw, context) {
  const FAMILIES = context.families;
  const problems = [];
  const name = String(raw.name ?? '').trim();
  if (!name) problems.push('The site needs a name.');
  else if (/[\r\n<>"\\]/.test(name)) problems.push('The site name may not contain line breaks, < > ", or a backslash (it becomes the email sender name).');
  else if (!/^[\x20-\x7e]+$/.test(name)) problems.push('The site name must be plain ASCII letters, digits, and punctuation (it becomes the email sender name, which auth-kit checks literally).');
  const project = slugify(name);
  if (name && !project) problems.push('The site name needs at least one letter or digit (it becomes the project slug).');

  const family = String(raw.family ?? '').trim().toLowerCase();
  if (!FAMILIES.includes(family)) problems.push(`The family must be one of ${FAMILIES.join(', ')}.`);

  const familySender = FAMILIES.includes(family) ? (context.familySender?.[family] ?? null) : null;
  const sender = String(raw.sender ?? familySender ?? '').trim().toLowerCase();
  if (!sender) problems.push(`Sender: ${FAMILIES.includes(family) ? `the ${family} family has no shared sender, so give` : 'give'} this site's sign-in@ mailbox on a domain verified in SES (e.g. sign-in@reports.example.org).`);
  else for (const p of senderAddressProblems(sender)) problems.push(`Sender: ${p}`);

  const familyMailbox = FAMILIES.includes(family) ? (context.familyHelpMailbox[family] ?? null) : null;
  const help = String(raw.help ?? familyMailbox ?? '').trim().toLowerCase();
  const helpPersonal = raw.helpPersonal === true;
  for (const p of helpAddressProblems(help, { personal: helpPersonal })) problems.push(`Help mailbox: ${p}`);

  const mode = String(raw.mode ?? 'invite').trim().toLowerCase();
  let accountCreation = null;
  if (!MODES.includes(mode)) {
    problems.push(`The account-creation mode must be one of ${MODES.join(', ')}.`);
  } else if (mode === 'domains') {
    const list = (Array.isArray(raw.domains) ? raw.domains : String(raw.domains ?? '').split(','))
      .map((d) => String(d).trim().toLowerCase().replace(/^[@.]/, ''))
      .filter(Boolean);
    if (list.length === 0) problems.push("'domains' mode needs at least one domain that may sign up (e.g. example.org).");
    for (const d of list) if (!DOMAIN_RE.test(d)) problems.push(`"${d}" isn't a domain.`);
    accountCreation = { mode, domains: [...new Set(list)], ...(raw.requestsAlso === true && { requestsAlso: true }) };
  } else {
    accountCreation = { mode };
  }

  const signUps = mode === 'domains' || mode === 'open';
  const privacy = raw.privacyNoticeUrl === undefined || raw.privacyNoticeUrl === null ? null : String(raw.privacyNoticeUrl).trim() || null;
  if (signUps && privacy === null) problems.push('A sign-up site links its privacy notice: give a site path (/privacy) or an https URL.');
  if (privacy !== null && !isLink(privacy)) problems.push(`The privacy notice "${privacy}" must be a site path like /privacy or an https URL.`);

  const ownerEmail = String(raw.ownerEmail ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(ownerEmail)) problems.push("The owner's email address doesn't look like an address.");

  const ownerName = context.namesOwner[family] === true && raw.ownerName ? String(raw.ownerName).trim() || null : null;
  if (ownerName !== null && /[\r\n<>"\\]/.test(ownerName)) problems.push("The owner's name may not contain line breaks, < > \", or a backslash.");

  return {
    problems,
    answers: {
      name,
      project,
      family,
      // The family's own sender and mailbox are written as null, so the site follows its family's.
      fromAddress: sender && sender === familySender ? null : sender,
      sender,
      replyTo: helpPersonal ? { address: help, personal: true } : help && help === familyMailbox ? null : help,
      help,
      helpPersonal,
      accountCreation,
      privacyNoticeUrl: privacy,
      ownerEmail,
      ownerName,
    },
  };
}

/** The TypeScript literal for a help address setting: null, a mailbox, or an acknowledged person's own address. */
export function helpSettingLiteral(setting) {
  if (setting === null) return 'null';
  if (typeof setting === 'object') return `{ address: ${tsString(setting.address)}, personal: true }`;
  return tsString(setting);
}

/** The TypeScript literal for an accountCreation value. */
export function accountCreationLiteral(setting) {
  if (setting.mode !== 'domains') return `{ mode: ${tsString(setting.mode)} }`;
  const domains = `[${setting.domains.map(tsString).join(', ')}]`;
  return `{ mode: 'domains', domains: ${domains}${setting.requestsAlso ? ', requestsAlso: true' : ''} }`;
}

/**
 * Replaces the one line `<indent><key>: …,` (its value, keeping the line's own `as …` type) in
 * site.config.ts. Throws if the line isn't there exactly once: setup never guesses where to write.
 */
export function replaceConfigLine(text, indent, key, literal, typeSuffix = '') {
  const pattern = new RegExp(`^${indent}${key}: .*,$`, 'gm');
  const matches = text.match(pattern) ?? [];
  if (matches.length !== 1) {
    throw new Error(`site.config.ts: expected exactly one line "${indent}${key}: …," (found ${matches.length}). Put it back in the template's one-line form, then run setup again.`);
  }
  return text.replace(pattern, () => `${indent}${key}: ${literal}${typeSuffix},`);
}

/**
 * site.config.ts with the answers in it.
 * @param {string} text  the current file
 * @param {ReturnType<typeof checkAnswers>['answers']} a
 */
export function applyAnswers(text, a) {
  const domain = a.ownerEmail.slice(a.ownerEmail.lastIndexOf('@') + 1);
  let out = text;
  out = replaceConfigLine(out, '  ', 'name', tsString(a.name));
  out = replaceConfigLine(out, '  ', 'family', tsString(a.family), ' as SiteFamily');
  out = replaceConfigLine(out, '  ', 'project', tsString(a.project));
  out = replaceConfigLine(out, '  ', 'ownerEmail', tsString(a.ownerEmail), ' as string | null');
  out = replaceConfigLine(out, '  ', 'ownerName', a.ownerName === null ? 'null' : tsString(a.ownerName), ' as string | null');
  out = replaceConfigLine(out, '    ', 'fromAddress', a.fromAddress === null ? 'null' : tsString(a.fromAddress), ' as string | null');
  out = replaceConfigLine(out, '    ', 'replyTo', helpSettingLiteral(a.replyTo), ' as SiteHelpAddress | null');
  out = replaceConfigLine(out, '  ', 'accountCreation', accountCreationLiteral(a.accountCreation), ' as AccountCreationSettings');
  out = replaceConfigLine(out, '  ', 'privacyNoticeUrl', a.privacyNoticeUrl === null ? 'null' : tsString(a.privacyNoticeUrl), ' as string | null');
  out = replaceConfigLine(out, '  ', 'alertEmails', `[${tsString(a.ownerEmail)}]`, ' as readonly string[]');
  // The template's placeholder invite domain becomes the owner's; a site that set its own keeps it.
  if (/^ {2}inviteDomains: \['example\.com'\],$/m.test(out)) out = replaceConfigLine(out, '  ', 'inviteDomains', `[${tsString(domain)}]`);
  return out;
}

/** personas.json with every `.test` address on the site's own `<project>.test` domain (the rest of the file as it was). */
export function applyPersonaDomain(text, project) {
  if (!Array.isArray(JSON.parse(text))) throw new Error('personas.json must be an array.');
  const domain = `${project}.test`;
  return text.replace(/("email":\s*")([^"@]+)@[^"]+(")/g, (_, open, local, close) => `${open}${local}@${domain}${close}`);
}

/** What setup will write, for the confirmation. */
export function describeAnswers(a) {
  const mode = a.accountCreation.mode === 'domains' ? `domains (${a.accountCreation.domains.join(', ')}${a.accountCreation.requestsAlso ? '; others may request access' : ''})` : a.accountCreation.mode;
  return [
    `  name              ${a.name}`,
    `  project           ${a.project}  (AWS tags; personas on ${a.project}.test)`,
    `  family            ${a.family}`,
    `  sender            ${a.sender}${a.fromAddress === null ? '  (the family’s)' : '  (its domain must be verified in SES)'}`,
    `  help mailbox      ${a.help}${a.replyTo === null ? '  (the family’s)' : a.helpPersonal ? '  (a person’s own, on purpose)' : ''}`,
    `  accounts          ${mode}`,
    ...(a.privacyNoticeUrl !== null ? [`  privacy notice    ${a.privacyNoticeUrl}`] : []),
    `  owner             ${a.ownerEmail}${a.ownerName ? ` (${a.ownerName})` : ''}`,
  ];
}
