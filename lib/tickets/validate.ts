/**
 * Input checks for new tickets. Server actions and route handlers take untrusted input: validate
 * shape and size on the server, whatever the form in the browser already checked.
 */
import { TICKET_LIMITS } from './types';

export type TicketInputResult = { ok: true; title: string; body: string } | { ok: false; field: 'title' | 'body'; error: string };

// Control characters other than tab and newlines.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function validateTicketInput(input: { title?: unknown; body?: unknown }): TicketInputResult {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const body = typeof input.body === 'string' ? input.body.replace(/\r\n/g, '\n').trim() : '';
  if (title.length === 0) return { ok: false, field: 'title', error: 'Give the ticket a title.' };
  if (title.length > TICKET_LIMITS.titleMax) {
    return { ok: false, field: 'title', error: `Keep the title under ${TICKET_LIMITS.titleMax} characters.` };
  }
  if (CONTROL.test(title) || title.includes('\n')) return { ok: false, field: 'title', error: 'The title has characters it can’t contain.' };
  if (body.length > TICKET_LIMITS.bodyMax) {
    return { ok: false, field: 'body', error: `Keep the details under ${TICKET_LIMITS.bodyMax} characters.` };
  }
  if (CONTROL.test(body)) return { ok: false, field: 'body', error: 'The details have characters they can’t contain.' };
  return { ok: true, title, body };
}

/** Clamps a requested list size to the store's limits. */
export function listLimit(requested: unknown): number {
  const n = typeof requested === 'string' ? Number.parseInt(requested, 10) : typeof requested === 'number' ? requested : Number.NaN;
  if (!Number.isInteger(n) || n < 1) return TICKET_LIMITS.listDefault;
  return Math.min(n, TICKET_LIMITS.listMax);
}
