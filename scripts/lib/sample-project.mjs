// The sample project the Manager, Contributor, and Reader personas (personas.json) have roles on, and
// the one access change that gives them those roles: the pure half of `npm run projects:seed`.
// No I/O here, so the unit tests cover it.

/** The same ID in every sandbox (a v4-shaped UUID), so seeding twice finds the project instead of making another. */
export const SAMPLE_PROJECT = Object.freeze({
  id: '5a3f0c2e-7b1d-4e8a-9c6f-0d2b4e6a8c10',
  name: 'Sample project',
  summary: 'Seeded for local development (npm run projects:seed): the Manager, Contributor, and Reader personas have their roles here.',
});

/** Which persona (personas.json key) has which role on it. */
export const SAMPLE_ROLES = Object.freeze({ manager: 'manager', contributor: 'contributor', reader: 'reader' });

/** The persona that creates it: Admin – content & people (site admins who manage people create projects). */
export const SAMPLE_CREATOR = 'admin-content-people';

/**
 * The commit that gives each sample persona its role, given the project's current access record (or
 * null when it has none): only what's missing or different, at the version read, with the access
 * record's Manager count kept right. Null when there's nothing to do.
 * @param {{ meta: { version: number, managers: number, createdAt: string, createdBy: string } | null, members: { sub: string, role: string }[] }} access
 * @param {Record<string, { sub: string, email: string }>} people  persona key → the account
 * @param {{ sub: string, email: string }} by  who's recorded as giving the access
 * @param {string} now  ISO 8601
 */
export function sampleAccessCommit(access, people, by, now) {
  const current = new Map(access.members.map((m) => [m.sub, m.role]));
  const put = [];
  for (const [key, role] of Object.entries(SAMPLE_ROLES)) {
    const person = people[key];
    if (!person) throw new Error(`personas.json has no "${key}" persona (the sample ${role}).`);
    if (current.get(person.sub) === role) continue;
    put.push({ type: 'project', id: SAMPLE_PROJECT.id, sub: person.sub, role, email: person.email, addedBy: by.sub, addedByEmail: by.email, addedAt: now });
    current.set(person.sub, role);
  }
  if (put.length === 0) return null;
  const expectedVersion = access.meta ? access.meta.version : null;
  const managers = [...current.values()].filter((role) => role === 'manager').length;
  return {
    expectedVersion,
    meta: {
      type: 'project',
      id: SAMPLE_PROJECT.id,
      version: (expectedVersion ?? 0) + 1,
      managers,
      createdAt: access.meta?.createdAt ?? now,
      createdBy: access.meta?.createdBy ?? by.sub,
      updatedAt: now,
      updatedBy: by.sub,
    },
    put,
  };
}
