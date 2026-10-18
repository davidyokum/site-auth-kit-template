export declare const SAMPLE_PROJECT: Readonly<{ id: string; name: string; summary: string }>;
export declare const SAMPLE_ROLES: Readonly<Record<'manager' | 'contributor' | 'reader', 'manager' | 'contributor' | 'reader'>>;
export declare const SAMPLE_CREATOR: string;
export interface SampleAccess {
  meta: { version: number; managers: number; createdAt: string; createdBy: string } | null;
  members: { sub: string; role: string }[];
}
export declare function sampleAccessCommit(
  access: SampleAccess,
  people: Record<string, { sub: string; email: string }>,
  by: { sub: string; email: string },
  now: string,
): {
  expectedVersion: number | null;
  meta: { type: 'project'; id: string; version: number; managers: number; createdAt: string; createdBy: string; updatedAt: string; updatedBy: string };
  put: { type: 'project'; id: string; sub: string; role: 'manager' | 'contributor' | 'reader'; email: string; addedBy: string; addedByEmail: string; addedAt: string }[];
} | null;
