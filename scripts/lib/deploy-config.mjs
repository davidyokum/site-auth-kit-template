// The account-assert preflight's pure logic (03 §2 Foundation: "every script pins its AWS profile and
// asserts the account ID"). No I/O here, so the unit tests cover every refusal.

/** The template's placeholder. A real site replaces it; the preflight refuses it. */
export const PLACEHOLDER_ACCOUNT_ID = '000000000000';

const PROFILE_RE = /^[A-Za-z0-9_.+=,@-]{1,64}$/;
const REGION_RE = /^[a-z]{2}(?:-[a-z]+)+-\d$/;
const KEYS = new Set(['awsProfile', 'awsAccountId', 'region']);

/**
 * Parses deploy.config.json. Throws one error listing every problem, so a misconfiguration can't
 * fall through to "use whatever the default profile is".
 * @param {string} text
 * @returns {{ awsProfile: string, awsAccountId: string, region: string }}
 */
export function parseDeployConfig(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new Error(`deploy.config.json isn't valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('deploy.config.json must be a JSON object.');
  const problems = [];
  for (const key of Object.keys(raw)) if (!KEYS.has(key)) problems.push(`unknown key "${key}"`);
  const { awsProfile, awsAccountId, region } = raw;
  if (typeof awsProfile !== 'string' || !PROFILE_RE.test(awsProfile)) {
    problems.push('awsProfile must name an AWS CLI profile, e.g. "personal"');
  } else if (awsProfile === 'default') {
    problems.push('awsProfile "default" is refused: name the profile you mean, so a changed default can never redirect a deploy');
  }
  if (typeof awsAccountId !== 'string' || !/^\d{12}$/.test(awsAccountId)) {
    problems.push('awsAccountId must be the 12-digit AWS account ID, as a string');
  } else if (awsAccountId === PLACEHOLDER_ACCOUNT_ID) {
    problems.push(`awsAccountId is still the template's placeholder (${PLACEHOLDER_ACCOUNT_ID}): set the account this site deploys to`);
  }
  if (typeof region !== 'string' || !REGION_RE.test(region)) problems.push('region must be an AWS Region, e.g. "us-east-1"');
  if (problems.length > 0) throw new Error(`deploy.config.json:\n- ${problems.join('\n- ')}`);
  return { awsProfile, awsAccountId, region };
}

/**
 * Reads `aws sts get-caller-identity --output json`.
 * @param {string} stdout
 * @returns {{ account: string, arn: string }}
 */
export function parseCallerIdentity(stdout) {
  let raw;
  try {
    raw = JSON.parse(stdout);
  } catch {
    throw new Error("Couldn't read the output of `aws sts get-caller-identity`.");
  }
  const account = raw?.Account;
  const arn = raw?.Arn;
  if (typeof account !== 'string' || !/^\d{12}$/.test(account) || typeof arn !== 'string') {
    throw new Error('`aws sts get-caller-identity` returned no account ID.');
  }
  return { account, arn };
}

/**
 * Null when the profile reaches the declared account; otherwise why not.
 * @param {{ awsProfile: string, awsAccountId: string }} config
 * @param {{ account: string, arn: string }} identity
 */
export function accountMismatch(config, identity) {
  if (identity.account === config.awsAccountId) return null;
  return (
    `Profile "${config.awsProfile}" reaches AWS account ${identity.account} (${identity.arn}), ` +
    `but deploy.config.json declares ${config.awsAccountId}. Refusing: nothing was run. ` +
    'Fix the profile or the config; never edit the check away.'
  );
}

/**
 * The command `--exec` runs after the check passes: always a locally installed binary (`npx
 * --no-install`, never a download), always with the checked profile, and with the checked account
 * when the tool can verify it too (`auth-kit seed-personas --account`).
 * @param {{ awsProfile: string, awsAccountId: string }} config
 * @param {string[]} command  e.g. ['ampx', 'sandbox'] plus any extra arguments
 * @param {{ passAccount?: boolean }} [options]
 * @returns {{ file: string, args: string[] }}
 */
export function execPlan(config, command, options = {}) {
  if (command.length === 0) throw new Error('--exec needs a command, e.g. --exec ampx sandbox');
  for (const arg of command) {
    if (arg === '--profile' || arg.startsWith('--profile=') || arg === '--account' || arg.startsWith('--account=')) {
      throw new Error(`Don't pass ${arg.split('=')[0]}: the preflight sets it from deploy.config.json.`);
    }
  }
  const args = ['--no-install', ...command, '--profile', config.awsProfile];
  if (options.passAccount) args.push('--account', config.awsAccountId);
  return { file: 'npx', args };
}
