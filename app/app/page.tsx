/**
 * The members' sample page: a ticket list filtered on the server, in the query (a member's own
 * tickets; every ticket for staff with `tickets.read-all`), and a form that files a new one.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { auth, pages } from '@/lib/auth';
import { type Ticket, ticketStore } from '@/lib/tickets';
import { createTicket } from './actions';
import { TicketForm } from './ticket-form';

export const metadata: Metadata = { title: 'Tickets' };

async function loadTickets(sub: string, seeAll: boolean): Promise<{ tickets: Ticket[] } | { error: string }> {
  try {
    const store = ticketStore();
    return { tickets: seeAll ? await store.listRecent() : await store.listForOwner(sub) };
  } catch (error) {
    // Honest data: a failed load says why; it never renders as "no tickets".
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export default async function TicketsPage() {
  const user = await pages.requireUser();
  const seeAll = auth.can(user, 'tickets.read-all');
  const result = await loadTickets(user.sub, seeAll);

  return (
    <div className="stack">
      <h1>Tickets</h1>
      <p className="muted">{seeAll ? 'You can see every ticket (staff view).' : 'Only you (and staff) can see your tickets.'}</p>
      {'error' in result ? (
        <p className="notice notice-error" role="alert">
          — Couldn&apos;t load tickets: {result.error}
        </p>
      ) : result.tickets.length === 0 ? (
        <p className="muted">No tickets yet.</p>
      ) : (
        <ul className="list">
          {result.tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link href={`/app/tickets/${ticket.id}`}>{ticket.title}</Link>{' '}
              <span className="muted small">
                · {new Date(ticket.createdAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC
                {seeAll && ticket.ownerSub === user.sub ? ' · yours' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <TicketForm action={createTicket} />
    </div>
  );
}
