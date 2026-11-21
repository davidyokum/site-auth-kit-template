// Types for kit-upgrade.mjs (the "auth-kit upgrade" workflow's rules).
export type UpdateType = 'patch' | 'minor' | 'major';
export interface ReleaseMeta {
  upgrade: UpdateType;
  siteSteps: 'none' | 'migration';
  /** What the release fixes (an advisory ID or a few words), or null. */
  security: string | null;
}
export interface AutoMergeDecision {
  state: 'success' | 'pending';
  description: string;
}
export const KIT_RELEASES: string;
export function kitUrl(version: string): string;
export function kitVersionOfUrl(spec: unknown): string | null;
export function updateType(from: string, to: string): UpdateType | null;
export function releaseMeta(notes: unknown): ReleaseMeta | null;
export function autoMergeDecision(input: { update: string | undefined; meta: ReleaseMeta | null }): AutoMergeDecision;
export function packageJsonProblems(basePkg: Record<string, unknown>, headPkg: Record<string, unknown>): string[];
export function lockfileProblems(baseLock: Record<string, unknown>, headLock: Record<string, unknown>): string[];
export function lockPinsRelease(lock: unknown, field: 'dependencies' | 'devDependencies', version: string, integrity?: string): boolean;
export function changedFileProblems(files: readonly string[], dir: string): string[];
