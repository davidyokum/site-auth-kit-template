// Types for deploy-config.mjs (plain JavaScript so the preflight runs with no build step).
export declare const PLACEHOLDER_ACCOUNT_ID: '000000000000';

export interface DeployConfig {
  awsProfile: string;
  awsAccountId: string;
  region: string;
}

export interface CallerIdentity {
  account: string;
  arn: string;
}

export declare function parseDeployConfig(text: string): DeployConfig;
export declare function parseCallerIdentity(stdout: string): CallerIdentity;
export declare function accountMismatch(config: Pick<DeployConfig, 'awsProfile' | 'awsAccountId'>, identity: CallerIdentity): string | null;
export declare function execPlan(
  config: Pick<DeployConfig, 'awsProfile' | 'awsAccountId'>,
  command: string[],
  options?: { passAccount?: boolean },
): { file: string; args: string[] };
