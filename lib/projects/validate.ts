/**
 * Input checks for projects. Server actions and route handlers take untrusted input: validate shape
 * and size on the server, whatever the form in the browser already checked.
 */
import { PROJECT_LIMITS } from './types';

export type ProjectInputResult = { ok: true; name: string; summary: string } | { ok: false; field: 'name' | 'summary'; error: string };

// Control characters other than tab and newlines.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function validateProjectInput(input: { name?: unknown; summary?: unknown }): ProjectInputResult {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const summary = typeof input.summary === 'string' ? input.summary.replace(/\r\n/g, '\n').trim() : '';
  if (name.length === 0) return { ok: false, field: 'name', error: 'Give the project a name.' };
  if (name.length > PROJECT_LIMITS.nameMax) return { ok: false, field: 'name', error: `Keep the name under ${PROJECT_LIMITS.nameMax} characters.` };
  if (CONTROL.test(name) || name.includes('\n')) return { ok: false, field: 'name', error: 'The name has characters it can’t contain.' };
  if (summary.length > PROJECT_LIMITS.summaryMax) {
    return { ok: false, field: 'summary', error: `Keep the summary under ${PROJECT_LIMITS.summaryMax} characters.` };
  }
  if (CONTROL.test(summary)) return { ok: false, field: 'summary', error: 'The summary has characters it can’t contain.' };
  return { ok: true, name, summary };
}

/** Clamps a requested list size to the store's limits. */
export function listLimit(requested: unknown): number {
  const n = typeof requested === 'string' ? Number.parseInt(requested, 10) : typeof requested === 'number' ? requested : Number.NaN;
  if (!Number.isInteger(n) || n < 1) return PROJECT_LIMITS.listDefault;
  return Math.min(n, PROJECT_LIMITS.listMax);
}
