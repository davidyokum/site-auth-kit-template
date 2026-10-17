/**
 * One ticket by ID. Loads the record and checks this person may see it (they filed it, or hold
 * `tickets.read-all`); anyone else gets 404, the same answer as a ticket that doesn't exist.
 */
import { PRIVATE_NO_STORE, withAuthErrors } from 'auth-kit/server';
import { auth } from '@/lib/auth';
import { ticketStore } from '@/lib/tickets';

export const GET = withAuthErrors(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await auth.requireUser({ request });
  const { id } = await params;
  const ticket = auth.requireRecordAccess(user, await ticketStore().get(id), {
    owner: (t) => t.ownerSub,
    coveredBy: 'tickets.read-all',
  });
  return Response.json({ ticket }, { headers: { 'Cache-Control': PRIVATE_NO_STORE } });
});
