// Pure parts of scripts/preview-password.mjs (03 §1 Tier 1: "Amplify branch password, on by default
// for non-production branches"). No I/O, so the unit tests cover them.

const APP_ID_RE = /^d[a-z0-9]{6,20}$/;
const BRANCH_RE = /^[A-Za-z0-9._/-]{1,255}$/;

/**
 * @param {string[]} argv
 * @returns {{ appId: string, target: { kind: 'branch', branch: string } | { kind: 'auto' }, allowLive: boolean, username: string }}
 */
export function parsePreviewArgs(argv) {
  const out = { appId: '', branch: '', auto: false, allowLive: false, username: 'preview' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`${arg} needs a value`);
      return v;
    };
    if (arg === '--app-id') out.appId = value();
    else if (arg === '--branch') out.branch = value();
    else if (arg === '--username') out.username = value();
    else if (arg === '--auto-branches') out.auto = true;
    else if (arg === '--allow-live-branch') out.allowLive = true;
    else throw new Error(`unknown option ${arg}`);
  }
  if (!APP_ID_RE.test(out.appId)) throw new Error('--app-id must be the Amplify app ID (Amplify console → App settings → General).');
  if (out.auto === Boolean(out.branch)) throw new Error('pass exactly one of --branch <name> or --auto-branches');
  if (out.branch && !BRANCH_RE.test(out.branch)) throw new Error(`--branch "${out.branch}" isn't a branch name`);
  if (out.branch === 'main' && !out.allowLive) {
    throw new Error('main is the live site. A password there hides it from everyone; pass --allow-live-branch only before launch.');
  }
  if (!out.username || out.username.includes(':') || out.username.length > 255) throw new Error('--username can’t contain ":"');
  return {
    appId: out.appId,
    target: out.branch ? { kind: 'branch', branch: out.branch } : { kind: 'auto' },
    allowLive: out.allowLive,
    username: out.username,
  };
}

/** Null when the password is fit for a shared preview gate; otherwise why not. */
export function previewPasswordProblem(password) {
  if (typeof password !== 'string' || password.length < 16) return 'Use at least 16 characters (generate it in your password manager).';
  if (password.includes(':')) return 'The password can’t contain ":".';
  if (password.length > 255) return 'Keep it under 255 characters.';
  return null;
}

/** Amplify's `basicAuthCredentials`: base64 of `username:password`. */
export function basicAuthCredentials(username, password) {
  return Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
}

/**
 * The `--cli-input-json` body for the AWS CLI: `amplify update-branch` for one branch, or
 * `amplify update-app` with `autoBranchCreationConfig` so branches Amplify creates later start
 * behind the password too. Passed in a 0600 temp file, never on the command line.
 */
export function previewPasswordRequest(args, password) {
  const credentials = basicAuthCredentials(args.username, password);
  if (args.target.kind === 'branch') {
    return {
      command: ['amplify', 'update-branch'],
      input: { appId: args.appId, branchName: args.target.branch, enableBasicAuth: true, basicAuthCredentials: credentials },
    };
  }
  return {
    command: ['amplify', 'update-app'],
    input: { appId: args.appId, autoBranchCreationConfig: { enableBasicAuth: true, basicAuthCredentials: credentials } },
  };
}
