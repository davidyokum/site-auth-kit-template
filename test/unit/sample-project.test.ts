/**
 * The sample Manager, Contributor, and Reader (personas.json) and `npm run projects:seed`, which gives
 * them their roles on a sample project in a sandbox: only what's missing, in one access change that
 * auth-kit's store accepts.
 */
import { createMemoryResourceStore } from 'auth-kit/resources';
import { describe, expect, it } from 'vitest';
import personas from '@/personas.json';
import { SAMPLE_CREATOR, SAMPLE_PROJECT, SAMPLE_ROLES, sampleAccessCommit } from '@/scripts/lib/sample-project.mjs';
import { PROJECT_ID_RE } from '@/lib/projects/types';

const sub = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const people = { manager: { sub: sub(1), email: 'manager@example-site.test' }, contributor: { sub: sub(2), email: 'contributor@example-site.test' }, reader: { sub: sub(3), email: 'reader@example-site.test' } };
const by = { sub: sub(9), email: 'admin-content-people@example-site.test' };
const ref = { type: 'project', id: SAMPLE_PROJECT.id };

describe('the sample personas', () => {
  it('are members (no site role), one per resource role, with the creator an admin who manages people', () => {
    for (const key of Object.keys(SAMPLE_ROLES)) expect(personas.find((p) => p.key === key)?.groups).toEqual([]);
    expect(personas.find((p) => p.key === SAMPLE_CREATOR)?.groups).toEqual(['admin-content-people']);
    expect(PROJECT_ID_RE.test(SAMPLE_PROJECT.id)).toBe(true);
  });
});

describe('the seed’s access change (sampleAccessCommit)', () => {
  it('gives each persona its role in one commit the store accepts, then has nothing left to do', async () => {
    const store = createMemoryResourceStore();
    const first = sampleAccessCommit(await store.getAccess(ref), people, by, '2026-10-18T12:00:00.000Z');
    expect(first?.meta).toMatchObject({ version: 1, managers: 1 });
    await store.commit(ref, first!);
    const access = await store.getAccess(ref);
    expect(Object.fromEntries(access.members.map((m) => [m.email, m.role]))).toEqual({
      'manager@example-site.test': 'manager',
      'contributor@example-site.test': 'contributor',
      'reader@example-site.test': 'reader',
    });
    expect(sampleAccessCommit(access, people, by, '2026-10-18T12:05:00.000Z')).toBeNull();
  });

  it('fixes only what’s different, at the version it read, and refuses a missing persona', async () => {
    const store = createMemoryResourceStore();
    await store.commit(ref, sampleAccessCommit(await store.getAccess(ref), { ...people, reader: { ...people.reader } }, by, '2026-10-18T12:00:00.000Z')!);
    const access = await store.getAccess(ref);
    const changed = sampleAccessCommit({ ...access, members: access.members.map((m) => (m.sub === sub(3) ? { ...m, role: 'contributor' } : m)) }, people, by, '2026-10-18T12:05:00.000Z');
    expect(changed?.put.map((m) => m.email)).toEqual(['reader@example-site.test']);
    expect(changed?.expectedVersion).toBe(access.meta?.version);
    expect(() => sampleAccessCommit({ meta: null, members: [] }, { manager: people.manager }, by, 'x')).toThrow(/no "contributor" persona/);
  });
});
