/**
 * The sample API: GET lists tickets (a member's own, or every ticket with `tickets.read-all`);
 * POST files one. Each handler checks the person itself (the proxy is never the only gate),
 * answers 401/403/404/503 through `withAuthErrors`, and is never cached.
 */
import { recordChange } from 'auth-kit/admin';
import { assertSameOrigin, PRIVATE_NO_STORE, withAuthErrors } from 'auth-kit/server';
import { auditLog } from '@/lib/audit-log';
import { auth } from '@/lib/auth';
import { expectedOrigin } from '@/lib/origin';
import { listLimit, ticketStore, validateTicketInput } from '@/lib/tickets';

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
  return Response.json({ ticket }, { status: 201, headers: NO_STORE });
});
