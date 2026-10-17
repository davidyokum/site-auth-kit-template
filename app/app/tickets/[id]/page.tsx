/**
 * One ticket. A route that takes a record ID loads the record and checks this person may see it:
 * they filed it, or they hold `tickets.read-all`. Anyone else gets "not found" (404), never
 * "forbidden": the page doesn't confirm the ticket exists (03 §2 Enforcement).
 */
import { handlePageAuthError } from 'auth-kit/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { auth, pages } from '@/lib/auth';
import { type Ticket, ticketStore } from '@/lib/tickets';

export const metadata: Metadata = { title: 'Ticket' };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pages.requireUser();
  const { id } = await params;
  let ticket: Ticket;
  try {
    ticket = auth.requireRecordAccess(user, await ticketStore().get(id), {
      owner: (t) => t.ownerSub,
      coveredBy: 'tickets.read-all',
    });
  } catch (error) {
    return handlePageAuthError(error); // NotFoundError → Next's not-found page (404)
  }

  return (
    <article className="stack">
      <p>
        <Link href="/app">← Tickets</Link>
      </p>
      <h1>{ticket.title}</h1>
      <p className="muted small">
        Filed {new Date(ticket.createdAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC
        {ticket.ownerSub === user.sub ? ' by you' : ''}
      </p>
      {/* Rendered as text: React escapes it. Never dangerouslySetInnerHTML with stored content. */}
      <p className="card">{ticket.body || <span className="muted">No details.</span>}</p>
    </article>
  );
}
