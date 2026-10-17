/**
 * The sample API: GET lists tickets (a member's own, or every ticket with `tickets.read-all`);
 * POST files one. Each handler checks the person itself (the proxy is never the only gate),
 * answers 401/403/404/503 through `withAuthErrors`, and is never cached.
 */
import { assertSameOrigin, PRIVATE_NO_STORE, withAuthErrors } from 'auth-kit/server';
import { auth } from '@/lib/auth';
import { expectedOrigin } from '@/lib/origin';
import { listLimit, ticketStore, validateTicketInput } from '@/lib/tickets';
import { fileTicket } from '@/lib/tickets/file-ticket';

const NO_STORE = { 'Cache-Control': PRIVATE_NO_STORE };

export const GET = withAuthErrors(async (request: Request) => {
  const user = await auth.requireUser({ request });
  const limit = listLimit(new URL(request.url).searchParams.get('limit'));
  const store = ticketStore();
  // Filtered in the query, on the server: a member's list never contains anyone else's ticket.
  const tickets = auth.can(user, 'tickets.read-all') ? await store.listRecent(limit) : await store.listForOwner(user.sub, limit);
  return Response.json({ tickets }, { headers: NO_STORE });
});

export const POST = withAuthErrors(async (request: Request) => {
  const user = await auth.requireUser({ request });
  // A state change must come from this site's own pages (403 origin_mismatch otherwise).
  assertSameOrigin(request, { expectedOrigin: expectedOrigin() });
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return Response.json({ error: 'unsupported_media_type', message: 'Send JSON.' }, { status: 415, headers: NO_STORE });
  }
  const body = (await request.json().catch(() => null)) as { title?: unknown; body?: unknown } | null;
  const input = validateTicketInput(body ?? {});
  if (!input.ok) return Response.json({ error: 'invalid_input', field: input.field, message: input.error }, { status: 400, headers: NO_STORE });

  const result = await fileTicket(user, input);
  if (!result.ok) {
    return Response.json(
      { error: 'audit_unavailable', message: "The activity log couldn't record this, so nothing was filed." },
      { status: 503, headers: { ...NO_STORE, 'Retry-After': '5' } },
    );
  }
  return Response.json(
    { ticket: result.ticket, ...(!result.outcomeLogged && { warning: 'audit_incomplete' }) },
    { status: 201, headers: NO_STORE },
  );
});
