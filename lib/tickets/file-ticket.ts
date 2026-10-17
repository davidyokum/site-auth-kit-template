/**
 * Filing a ticket: the store write wrapped in the audit log's intent → call → result ordering
 * (auth-kit `recordChange`, ADR 0010). Shared by the server action and the API route so both log
 * the same way and report audit trouble the same honest way.
 */
import 'server-only';
import { AuditIncompleteError, AuditUnavailableError, recordChange } from 'auth-kit/admin';
import type { AuthUser } from 'auth-kit/server';
import { auditLog } from '@/lib/audit-log';
import { ticketStore } from './index';
import type { Ticket } from './types';

export type FileTicketResult =
  /** Filed. `outcomeLogged: false`: the ticket exists and its intent is logged, but the result row isn't. */
  | { ok: true; ticket: Ticket; outcomeLogged: boolean }
  /** The audit log couldn't take the intent, so nothing was filed. */
  | { ok: false; reason: 'audit_unavailable' };

export async function fileTicket(
  user: Pick<AuthUser, 'sub' | 'profile'>,
  input: { title: string; body: string },
): Promise<FileTicketResult> {
  const store = ticketStore();
  try {
    const ticket = await recordChange(auditLog(), {
      intent: {
        actor: { sub: user.sub, ...(user.profile?.email !== undefined && { email: user.profile.email }) },
        action: 'tickets.create',
        after: { title: input.title },
        calls: ['PutItem tickets'],
      },
      run: async (steps) => {
        // The owner is always the signed-in person, never something the request names.
        const created = await steps.call('PutItem tickets', () => store.create({ ownerSub: user.sub, title: input.title, body: input.body }));
        return { value: created, after: { id: created.id, title: created.title }, target: { recordId: created.id } };
      },
    });
    return { ok: true, ticket, outcomeLogged: true };
  } catch (error) {
    if (error instanceof AuditUnavailableError) return { ok: false, reason: 'audit_unavailable' };
    if (error instanceof AuditIncompleteError && error.value) return { ok: true, ticket: error.value as Ticket, outcomeLogged: false };
    throw error; // the write itself failed: logged as a failed result, reported as an error
  }
}
