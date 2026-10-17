// Types for assert-account.mjs.
import type { DeployConfig } from './deploy-config.mjs';

export declare function assertAccount(root: string): DeployConfig & { arn: string };
