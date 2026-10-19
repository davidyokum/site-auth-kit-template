// Types for deploy-config.mjs (plain JavaScript so the preflight runs with no build step).
export declare const PLACEHOLDER_ACCOUNT_ID: '000000000000';
export declare const AMPLIFY_APP_ID_RE: RegExp;
export declare const REGIONAL_WEB_ACL_ARN_RE: RegExp;

export interface DeployConfig {
  awsProfile: string;
  awsAccountId: string;
  region: string;
  /** The Amplify Hosting app ID once the app exists; null until then. */
  amplifyAppId: string | null;
  /** The user pool's web ACL: the account's shared ACL ARN, "own", or null (not chosen yet; sandboxes only). */
  webAcl: string | null;
}

export interface CallerIdentity {
  account: string;
  arn: string;
}

export declare function parseDeployConfig(text: string): DeployConfig;
export declare function webAclProblems(webAcl: unknown, where?: { awsAccountId?: unknown; region?: unknown }): string[];
export declare function parseCallerIdentity(stdout: string): CallerIdentity;
export declare function accountMismatch(config: Pick<DeployConfig, 'awsProfile' | 'awsAccountId'>, identity: CallerIdentity): string | null;
export declare function execPlan(
  config: Pick<DeployConfig, 'awsProfile' | 'awsAccountId'>,
  command: string[],
  options?: { passAccount?: boolean },
): { file: string; args: string[] };
