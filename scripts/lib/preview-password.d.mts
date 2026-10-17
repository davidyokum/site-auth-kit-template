// Types for preview-password.mjs (plain JavaScript so the script runs with no build step).
export interface PreviewArgs {
  appId: string;
  target: { kind: 'branch'; branch: string } | { kind: 'auto' };
  allowLive: boolean;
  username: string;
}

export declare function parsePreviewArgs(argv: string[]): PreviewArgs;
export declare function previewPasswordProblem(password: string): string | null;
export declare function basicAuthCredentials(username: string, password: string): string;
export declare function previewPasswordRequest(
  args: PreviewArgs,
  password: string,
): { command: string[]; input: Record<string, unknown> };
