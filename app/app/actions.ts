'use server';
/**
 * Server actions are public HTTP endpoints: anyone can POST to them with any input. Each one checks
 * the person itself, validates its input, and logs the change, whatever the page around it did.
 * The auth matrix can't see server actions (they're not in the build manifest), so
 * test/unit/actions.test.ts covers them.
 */
import { AuthUnavailableError, isAuthError } from 'auth-kit/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { validateTicketInput } from '@/lib/tickets';
import { fileTicket } from '@/lib/tickets/file-ticket';

export type CreateTicketState =
  | { ok: true; message: string; ticketId: string }
  | { ok: false; error: string; field?: 'title' | 'body' };

export async function createTicket(_previous: CreateTicketState | null, data: FormData): Promise<CreateTicketState> {
  let user;
  try {
    user = await auth.requireUser();
  } catch (error) {
    // "Couldn't check" is not "signed out": say which, and that nothing was saved.
    if (error instanceof AuthUnavailableError) return { ok: false, error: 'Couldn’t check your sign-in right now. Nothing was saved; try again.' };
    if (isAuthError(error)) return { ok: false, error: 'Your session has ended or doesn’t allow this. Sign in again, then retry.' };
    throw error;
  }

  const input = validateTicketInput({ title: data.get('title'), body: data.get('body') });
  if (!input.ok) return { ok: false, error: input.error, field: input.field };

  const result = await fileTicket(user, input);
  if (!result.ok) return { ok: false, error: 'The activity log couldn’t record this, so the ticket wasn’t filed. Try again.' };
  revalidatePath('/app');
  return {
    ok: true,
    message: result.outcomeLogged ? 'Ticket filed.' : 'Ticket filed, but the activity log didn’t record the outcome.',
    ticketId: result.ticket.id,
  };
}
