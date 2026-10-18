/**
 * Server actions are public endpoints the auth matrix can't see (they're not in the build's route
 * manifest), so each is tested here: it checks the person itself, validates input, and logs.
 * auth-kit's own tests cover the resource actions these delegate to (who may change access, the
 * last Manager, invites and their alert); here, that each action calls them and reports honestly.
 */
import { randomUUID } from 'node:crypto';
import { createMemoryAuditLog, type MemoryAuditLog } from 'auth-kit/admin';
import { RESOURCE_FORM_FIELDS as F } from 'auth-kit/resources';
import { AuthUnavailableError, ForbiddenError, MfaEnrollmentRequiredError, NotFoundError, UnauthenticatedError } from 'auth-kit/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryProjectStore } from '@/lib/projects/memory';

const state = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireResourceRole: vi.fn(),
  create: vi.fn(),
  store: undefined as unknown as ReturnType<typeof createMemoryProjectStore>,
  log: undefined as unknown as MemoryAuditLog,
  forms: {} as Record<string, ReturnType<typeof vi.fn>>,
  resourceForms: {} as Record<string, ReturnType<typeof vi.fn>>,
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: { requireUser: state.requireUser, requireResourceRole: state.requireResourceRole } }));
vi.mock('@/lib/projects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/projects')>()),
  projectStore: () => state.store,
}));
vi.mock('@/lib/audit-log', () => ({ auditLog: () => state.log }));
vi.mock('@/lib/resource-actions', () => ({ resourceActions: () => ({ create: state.create, forms: state.resourceForms }) }));
vi.mock('@/lib/admin', () => ({ peopleActions: () => ({ forms: state.forms }) }));
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));

const { createProjectAction } = await import('@/app/app/projects/actions');
const project = await import('@/app/app/projects/[id]/actions');
const people = await import('@/app/admin/people/actions');

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};
const admin = { sub: 'sub-admin', username: 'sub-admin', profile: { email: 'admin@example-site.test' } };

/** auth-kit's create, as far as these actions see it: it runs the app's write with a new ID. */
function fakeCreate() {
  state.create.mockImplementation(async (input: { run: (c: { id: string; manager: { sub: string } }) => Promise<unknown> }) => {
    const id = randomUUID();
    const value = await input.run({ id, manager: { sub: admin.sub } });
    return { ok: true, id, value, message: 'Created. You’re its Manager: you can share it from “Who has access”.' };
  });
}

beforeEach(() => {
  state.requireUser.mockReset();
  state.requireResourceRole.mockReset();
  state.create.mockReset();
  state.revalidatePath.mockReset();
  state.store = createMemoryProjectStore();
  state.log = createMemoryAuditLog();
});

describe('createProjectAction (app/app/projects/actions.ts)', () => {
  it('refuses without a session, or for a password user without an authenticator, and creates nothing', async () => {
    for (const error of [new UnauthenticatedError(), new MfaEnrollmentRequiredError()]) {
      state.requireUser.mockRejectedValueOnce(error);
      expect(await createProjectAction(null, form({ name: 'Roads' }))).toMatchObject({ ok: false });
    }
    expect(state.create).not.toHaveBeenCalled();
    expect(state.store.size).toBe(0);
  });

  it('says "couldn’t check" (not "signed out") when Cognito can’t be reached', async () => {
    state.requireUser.mockRejectedValue(new AuthUnavailableError());
    expect(await createProjectAction(null, form({ name: 'Roads' }))).toMatchObject({ ok: false, error: expect.stringMatching(/couldn’t check/i) });
  });

  it('validates input on the server before asking auth-kit', async () => {
    state.requireUser.mockResolvedValue(admin);
    expect(await createProjectAction(null, form({ name: '   ' }))).toMatchObject({ ok: false, field: 'name' });
    expect(state.create).not.toHaveBeenCalled();
  });

  it('lets auth-kit create the project’s access and the project together; the creator comes from the session, never the form', async () => {
    state.requireUser.mockResolvedValue(admin);
    fakeCreate();
    const result = await createProjectAction(null, form({ name: 'Roads 2027', summary: 'Resurfacing', managerEmail: ' member@example-site.test ', createdBy: 'someone-else' }));
    expect(result).toMatchObject({ ok: true, projectId: expect.any(String) });
    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'project', managerEmail: 'member@example-site.test' }));
    const [saved] = await state.store.listRecent();
    expect(saved).toMatchObject({ name: 'Roads 2027', summary: 'Resurfacing', createdBy: 'sub-admin', updatedBy: 'sub-admin' });
    expect(state.revalidatePath).toHaveBeenCalledWith('/app/projects');
  });

  it('passes on auth-kit’s refusal (a member can’t create projects; an unknown Manager) and saves nothing', async () => {
    state.requireUser.mockResolvedValue(admin);
    state.create.mockResolvedValueOnce({ ok: false, code: 'forbidden', error: 'Site admins create projects on this site and choose who manages each one.', changed: 'nothing' });
    expect(await createProjectAction(null, form({ name: 'Mine' }))).toEqual({ ok: false, error: 'Site admins create projects on this site and choose who manages each one.' });
    state.create.mockResolvedValueOnce({ ok: false, code: 'refused', guardrail: 'no_account', error: 'No account uses that address.', changed: 'nothing' });
    expect(await createProjectAction(null, form({ name: 'Theirs', managerEmail: 'nobody@example.org' }))).toMatchObject({ ok: false, field: 'managerEmail' });
    expect(state.store.size).toBe(0);
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });
});

describe('updateProjectAction (app/app/projects/[id]/actions.ts)', () => {
  const seed = async () => {
    const at = '2026-10-01T00:00:00.000Z';
    return state.store.create({ id: randomUUID(), name: 'Roads', summary: '', createdAt: at, createdBy: 'sub-admin', updatedAt: at, updatedBy: 'sub-admin' });
  };
  const allow = () => state.requireResourceRole.mockResolvedValue({ user: admin, role: 'contributor', can: () => true });

  it('checks edit access on this project, live, before reading anything', async () => {
    const p = await seed();
    allow();
    await project.updateProjectAction(null, form({ id: p.id, updatedAt: p.updatedAt, name: 'Roads 2027' }));
    expect(state.requireResourceRole).toHaveBeenCalledWith('project', p.id, 'edit', { live: true });
  });

  it('no access reads as "doesn’t exist, or no access"; seeing but not editing says so; nothing is saved', async () => {
    const p = await seed();
    state.requireResourceRole.mockRejectedValueOnce(new NotFoundError());
    expect(await project.updateProjectAction(null, form({ id: p.id, updatedAt: p.updatedAt, name: 'X' }))).toEqual({ ok: false, error: 'That project doesn’t exist, or you don’t have access to it.' });
    state.requireResourceRole.mockRejectedValueOnce(new ForbiddenError());
    expect(await project.updateProjectAction(null, form({ id: p.id, updatedAt: p.updatedAt, name: 'X' }))).toEqual({ ok: false, error: 'You can see this project but not edit it.' });
    state.requireResourceRole.mockRejectedValueOnce(new AuthUnavailableError());
    expect(await project.updateProjectAction(null, form({ id: p.id, updatedAt: p.updatedAt, name: 'X' }))).toMatchObject({ error: expect.stringMatching(/Couldn’t check your access/) });
    expect((await state.store.get(p.id))?.name).toBe('Roads');
    expect(state.log.rows).toHaveLength(0);
  });

  it('saves with intent and result in the audit log, naming the project', async () => {
    const p = await seed();
    allow();
    expect(await project.updateProjectAction(null, form({ id: p.id, updatedAt: p.updatedAt, name: 'Roads 2027', summary: 'Now with bike lanes' }))).toEqual({ ok: true, message: 'Saved.' });
    expect(await state.store.get(p.id)).toMatchObject({ name: 'Roads 2027', summary: 'Now with bike lanes', updatedBy: 'sub-admin' });
    expect(state.log.rows.map((r) => [r.phase, r.action])).toEqual([
      ['intent', 'projects.update'],
      ['result', 'projects.update'],
    ]);
    expect(state.log.rows[1]).toMatchObject({
      outcome: 'ok',
      target: { recordId: `project:${p.id}` },
      // The noun and name ride on the row, so the Activity page names the project, never its ID.
      before: { name: 'Roads', item: { noun: 'project', name: 'Roads' } },
      after: { name: 'Roads 2027', item: { noun: 'project', name: 'Roads 2027' } },
    });
    expect(state.revalidatePath).toHaveBeenCalledWith(`/app/projects/${p.id}`);
  });

  it('refuses a save over someone else’s newer edit, and saves nothing when the audit log is down', async () => {
    const p = await seed();
    allow();
    expect(await project.updateProjectAction(null, form({ id: p.id, updatedAt: 'an-older-version', name: 'Mine' }))).toMatchObject({ ok: false, error: expect.stringMatching(/Someone else changed this project/) });
    state.log.failNextAppends(1);
    expect(await project.updateProjectAction(null, form({ id: p.id, updatedAt: p.updatedAt, name: 'Unlogged' }))).toMatchObject({ ok: false, error: expect.stringMatching(/nothing was saved/) });
    expect((await state.store.get(p.id))?.name).toBe('Roads');
  });

  it('validates input on the server', async () => {
    const p = await seed();
    allow();
    expect(await project.updateProjectAction(null, form({ id: p.id, updatedAt: p.updatedAt, name: '' }))).toMatchObject({ ok: false, field: 'name' });
    expect(await project.updateProjectAction(null, form({ name: 'no id' }))).toMatchObject({ ok: false });
  });
});

describe('access actions on one project delegate to auth-kit (which checks live and keeps a Manager)', () => {
  const names = [
    ['addMember', 'add'],
    ['changeMemberRole', 'changeRole'],
    ['removeMember', 'remove'],
    ['inviteToProject', 'invite'],
  ] as const;

  it.each(names)('%s calls forms.%s and refreshes the project only on success', async (name, form_) => {
    state.resourceForms[form_] = vi.fn().mockResolvedValueOnce({ ok: true, message: 'done' }).mockResolvedValueOnce({ ok: false, code: 'forbidden', error: 'no', changed: 'nothing' });
    const data = form({ [F.type]: 'project', [F.id]: 'p-1', [F.sub]: 'someone' });
    expect(await project[name](null, data)).toMatchObject({ ok: true });
    expect(state.resourceForms[form_]).toHaveBeenCalledWith(null, data);
    expect(state.revalidatePath).toHaveBeenCalledWith('/app/projects/p-1');
    expect(await project[name](null, data)).toMatchObject({ ok: false });
    expect(state.revalidatePath).toHaveBeenCalledTimes(1);
  });
});

describe('People actions (app/admin/people/actions.ts) delegate to auth-kit, which checks live', () => {
  const names = ['invite', 'resend', 'changeRole', 'disable', 'enable', 'signOutEverywhere', 'deleteUser'] as const;

  it.each(names)('%s calls auth-kit’s form action and refreshes the page only on success', async (name) => {
    state.forms[name] = vi.fn().mockResolvedValueOnce({ ok: true, message: 'done' }).mockResolvedValueOnce({ ok: false, code: 'forbidden', error: 'no', changed: 'nothing' });
    const data = form({ sub: 'target' });
    expect(await people[name](null, data)).toMatchObject({ ok: true });
    expect(state.forms[name]).toHaveBeenCalledWith(null, data);
    expect(state.revalidatePath).toHaveBeenCalledTimes(1);
    expect(await people[name](null, data)).toMatchObject({ ok: false });
    expect(state.revalidatePath).toHaveBeenCalledTimes(1);
  });
});
