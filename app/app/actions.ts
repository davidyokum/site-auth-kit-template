'use server';
/**
 * Server actions are public HTTP endpoints: anyone can POST to them with any input. Each one checks
 * the person itself, validates its input, and logs the change, whatever the page around it did.
 * The auth matrix can't see server actions (they're not in the build manifest), so
 * test/unit/actions.test.ts covers them.
 */
import { recordChange } from 'auth-kit/admin';
import { isAuthError } from 'auth-kit/server';
import { revalidatePath } from 'next/cache';
import { auditLog } from '@/lib/audit-log';
import { auth } from '@/lib/auth';
import { ticketStore, validateTicketInput } from '@/lib/tickets';

export type CreateTicketState =
  | { ok: true; message: string; ticketId: string }
  | { ok: false; error: string; field?: 'title' | 'body' };

export async function createTicket(_previous: CreateTicketState | null, data: FormData): Promise<CreateTicketState> {
  let user;
  try {
    user = await auth.requireUser();
  } catch (error) {
    if (isAuthError(error)) return { ok: false, error: 'Your session has ended. Sign in again, then retry.' };
    throw error;
  }

  const input = validateTicketInput({ title: data.get('title'), body: data.get('body') });
  if (!input.ok) return { ok: false, error: input.error, field: input.field };

  const store = ticketStore();
  const ticket = await recordChange(auditLog(), {
    intent: {
      actor: { sub: user.sub, ...(user.profile?.email !== undefined && { email: user.profile.email }) },
      action: 'tickets.create',
      after: { title: input.title },
      calls: ['PutItem tickets'],
    },
    run: async (steps) => {
      const created = await steps.call('PutItem tickets', () => store.create({ ownerSub: user.sub, title: input.title, body: input.body }));
      return { value: created, after: { id: created.id, title: created.title }, target: { recordId: created.id } };
    },
  });

  revalidatePath('/app');
  return { ok: true, message: 'Ticket filed.', ticketId: ticket.id };
}
