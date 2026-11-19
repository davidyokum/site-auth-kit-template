export declare function signInModeGuard(
  signIn: { mode?: unknown } | undefined,
  deployed: { outputs?: { auth?: { mfa_configuration?: unknown } } | null; noBackendYet?: boolean; error?: string | null },
): { ok: boolean; message: string };
export declare function isNoBackendYet(output: unknown): boolean;
