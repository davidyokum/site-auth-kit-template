/**
 * An in-memory ticket store with the same behavior as the DynamoDB one. Used by the unit tests and
 * by the auth-matrix dev server (lib/tickets/index.ts, through auth-kit's matrix server mode). Never
 * in production: it forgets everything on restart, and lib/tickets/index.ts never chooses it outside
 * those two.
 */
import { randomUUID } from 'node:crypto';
import { type NewTicket, type Ticket, type TicketStore, TICKET_LIMITS } from './types';

export function createMemoryTicketStore(options: { now?: () => number; newId?: () => string } = {}): TicketStore & {
  readonly size: number;
} {
  const now = options.now ?? Date.now;
  const newId = options.newId ?? randomUUID;
  const rows = new Map<string, Ticket>();
  const newestFirst = (a: Ticket, b: Ticket) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);
  const clamp = (limit: number | undefined) => Math.min(Math.max(1, limit ?? TICKET_LIMITS.listDefault), TICKET_LIMITS.listMax);

  return {
    get size() {
      return rows.size;
    },
    async listForOwner(ownerSub, limit) {
      return [...rows.values()].filter((t) => t.ownerSub === ownerSub).sort(newestFirst).slice(0, clamp(limit)).map((t) => ({ ...t }));
    },
    async listRecent(limit) {
      return [...rows.values()].sort(newestFirst).slice(0, clamp(limit)).map((t) => ({ ...t }));
    },
    async get(id) {
      const found = rows.get(id);
      return found ? { ...found } : null;
    },
    async create(input: NewTicket) {
      const ticket: Ticket = { id: newId(), ownerSub: input.ownerSub, title: input.title, body: input.body, createdAt: new Date(now()).toISOString() };
      if (rows.has(ticket.id)) throw new Error('ticket id collision');
      rows.set(ticket.id, ticket);
      return { ...ticket };
    },
  };
}
