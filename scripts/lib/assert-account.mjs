// The account check every AWS-touching script runs first (03 §2 Foundation: "every script pins its
// AWS profile and asserts the account ID"). Reads deploy.config.json, asks STS which account the
// profile reaches (read-only), and refuses on any mismatch.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { accountMismatch, parseCallerIdentity, parseDeployConfig } from './deploy-config.mjs';

/**
 * @param {string} root  the project root (where deploy.config.json lives)
 * @returns {{ awsProfile: string, awsAccountId: string, region: string, amplifyAppId: string | null, arn: string }}
 * @throws {Error} with a message that says exactly what to fix
 */
export function assertAccount(root) {
  const config = parseDeployConfig(readFileSync(join(root, 'deploy.config.json'), 'utf8'));
  let identity;
  try {
    const stdout = execFileSync('aws', ['sts', 'get-caller-identity', '--profile', config.awsProfile, '--output', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, AWS_PAGER: '' },
    });
    identity = parseCallerIdentity(stdout);
  } catch (error) {
    const detail = error && typeof error === 'object' && 'stderr' in error && error.stderr ? String(error.stderr).trim() : String(error);
    throw new Error(`couldn't confirm the account for profile "${config.awsProfile}" (is the AWS CLI installed and signed in?): ${detail}`);
  }
  const mismatch = accountMismatch(config, identity);
  if (mismatch) throw new Error(mismatch);
  return { ...config, arn: identity.arn };
}
