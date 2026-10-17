/**
 * Server actions are public endpoints the auth matrix can't see (they're not in the build's route
 * manifest), so each is tested here: it checks the person itself, validates input, and logs.
 */
import { createMemoryAuditLog, type MemoryAuditLog } from 'auth-kit/admin';
import { AuthUnavailableError, MfaEnrollmentRequiredError, UnauthenticatedError } from 'auth-kit/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryTicketStore } from '@/lib/tickets/memory';

const state = vi.hoisted(() => ({
  requireUser: vi.fn(),
  store: undefined as unknown as ReturnType<typeof createMemoryTicketStore>,
  log: undefined as unknown as MemoryAuditLog,
  forms: {} as Record<string, ReturnType<typeof vi.fn>>,
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: { requireUser: state.requireUser } }));
vi.mock('@/lib/tickets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/tickets')>()),
  ticketStore: () => state.store,
}));
vi.mock('@/lib/audit-log', () => ({ auditLog: () => state.log }));
vi.mock('@/lib/admin', () => ({ peopleActions: () => ({ forms: state.forms }) }));
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));

const { createTicket } = await import('@/app/app/actions');
const people = await import('@/app/admin/people/actions');

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};
const member = { sub: 'sub-member', username: 'sub-member', profile: { email: 'member@example-site.test' } };

beforeEach(() => {
  state.requireUser.mockReset();
  state.revalidatePath.mockReset();
  state.store = createMemoryTicketStore();
  state.log = createMemoryAuditLog();
});

describe('createTicket (app/app/actions.ts)', () => {
  it('refuses without a session and changes nothing', async () => {
    state.requireUser.mockRejectedValue(new UnauthenticatedError());
    const result = await createTicket(null, form({ title: 'Hello' }));
    expect(result).toMatchObject({ ok: false });
    expect(state.store.size).toBe(0);
    expect(state.log.rows).toHaveLength(0);
  });

  it('refuses a password user without an authenticator (requireUser’s rule applies to actions too)', async () => {
    state.requireUser.mockRejectedValue(new MfaEnrollmentRequiredError());
    expect(await createTicket(null, form({ title: 'Hello' }))).toMatchObject({ ok: false });
    expect(state.store.size).toBe(0);
  });

  it('says "couldn’t check" (not "signed out") when Cognito can’t be reached, and saves nothing', async () => {
    state.requireUser.mockRejectedValue(new AuthUnavailableError());
    const result = await createTicket(null, form({ title: 'Hello' }));
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/couldn’t check/i) });
    expect(state.store.size).toBe(0);
  });

  it('validates input on the server', async () => {
    state.requireUser.mockResolvedValue(member);
    expect(await createTicket(null, form({ title: '   ' }))).toMatchObject({ ok: false, field: 'title' });
    expect(state.store.size).toBe(0);
  });

  it('files the ticket as the signed-in person (never from form input) and logs intent and result', async () => {
    state.requireUser.mockResolvedValue(member);
    const result = await createTicket(null, form({ title: 'Broken link', body: 'On the home page', ownerSub: 'someone-else' }));
    expect(result).toMatchObject({ ok: true });
    const [ticket] = await state.store.listRecent();
    expect(ticket).toMatchObject({ ownerSub: 'sub-member', title: 'Broken link' });
    expect(state.log.rows.map((r) => [r.phase, r.action])).toEqual([
      ['intent', 'tickets.create'],
      ['result', 'tickets.create'],
    ]);
    expect(state.log.rows[1]).toMatchObject({ outcome: 'ok', target: { recordId: ticket?.id } });
    expect(state.revalidatePath).toHaveBeenCalledWith('/app');
  });

  it('doesn’t file the ticket when the audit log can’t take the intent, and says so', async () => {
    state.requireUser.mockResolvedValue(member);
    state.log.failNextAppends(1);
    expect(await createTicket(null, form({ title: 'Unlogged' }))).toMatchObject({ ok: false, error: expect.stringMatching(/wasn’t filed/) });
    expect(state.store.size).toBe(0);
  });

  it('says so honestly when the ticket was filed but the result row couldn’t be written', async () => {
    state.requireUser.mockResolvedValue(member);
    const append = state.log.append.bind(state.log);
    let calls = 0;
    state.log.append = async (row) => (++calls === 1 ? append(row) : Promise.reject(new Error('result write failed')));
    const result = await createTicket(null, form({ title: 'Half logged' }));
    expect(result).toMatchObject({ ok: true, message: expect.stringMatching(/didn’t record the outcome/) });
    expect(state.store.size).toBe(1);
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
