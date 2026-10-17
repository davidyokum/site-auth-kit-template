/**
 * Environment that makes AWS unreachable from tests: no credentials can resolve (no keys, a profile
 * that doesn't exist, empty config and credentials files, no instance metadata), so a call that
 * slips past a mock fails at credential lookup and never reaches AWS. Used by the unit tests
 * (vitest.config.ts) and the auth-matrix dev server (test/matrix/global-setup.ts).
 */
export const AWS_BLOCKED_ENV: Record<string, string> = {
  AWS_PROFILE: 'tests-have-no-aws',
  AWS_CONFIG_FILE: '/nonexistent/aws-config',
  AWS_SHARED_CREDENTIALS_FILE: '/nonexistent/aws-credentials',
  AWS_EC2_METADATA_DISABLED: 'true',
  AWS_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: '',
  AWS_SECRET_ACCESS_KEY: '',
  AWS_SESSION_TOKEN: '',
  AWS_CONTAINER_CREDENTIALS_RELATIVE_URI: '',
  AWS_CONTAINER_CREDENTIALS_FULL_URI: '',
  AWS_WEB_IDENTITY_TOKEN_FILE: '',
  AWS_ROLE_ARN: '',
};
