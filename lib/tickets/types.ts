/**
 * The sample app's record: a ticket a member files. Each member sees only their own; staff with
 * `tickets.read-all` see every ticket. Replace with your site's own records, keeping the pattern:
 * lists filtered in the query on the server, and record routes that answer 404 to anyone else.
 */
export interface Ticket {
  id: string;
  /** The Cognito `sub` of the person who filed it. Never an email (emails change). */
  ownerSub: string;
  title: string;
  body: string;
  /** ISO 8601. */
  createdAt: string;
}

export interface NewTicket {
  ownerSub: string;
  title: string;
  body: string;
}

/** The only operations the app needs, so the store's IAM grant can be exactly these. */
export interface TicketStore {
  /** One person's tickets, newest first (a Query on the owner index, filtered on the server). */
  listForOwner(ownerSub: string, limit?: number): Promise<Ticket[]>;
  /** Every ticket, newest first. Only for people with `tickets.read-all`. */
  listRecent(limit?: number): Promise<Ticket[]>;
  /** One ticket by ID, or null. The caller checks access (`requireRecordAccess`). */
  get(id: string): Promise<Ticket | null>;
  create(input: NewTicket): Promise<Ticket>;
}

export const TICKET_LIMITS = {
  titleMax: 120,
  bodyMax: 2000,
  listDefault: 50,
  listMax: 100,
} as const;

/** Ticket IDs are random UUIDs; anything else can't name a ticket (and gets a 404). */
export const TICKET_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
