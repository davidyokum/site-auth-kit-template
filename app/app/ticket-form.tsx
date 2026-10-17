'use client';
import { useActionState } from 'react';
import { TICKET_LIMITS } from '@/lib/tickets/types';
import type { CreateTicketState } from './actions';

export function TicketForm({ action }: { action: (previous: CreateTicketState | null, data: FormData) => Promise<CreateTicketState> }) {
  const [state, formAction, pending] = useActionState(action, null);
  const fieldError = (field: 'title' | 'body') => (state && !state.ok && state.field === field ? state.error : null);
  return (
    <form action={formAction} className="card stack" aria-labelledby="new-ticket-heading">
      <h2 id="new-ticket-heading">File a ticket</h2>
      <div className="field">
        <label htmlFor="ticket-title">Title</label>
        <input
          id="ticket-title"
          name="title"
          required
          maxLength={TICKET_LIMITS.titleMax}
          aria-invalid={fieldError('title') ? true : undefined}
          aria-describedby={fieldError('title') ? 'ticket-title-error' : undefined}
        />
        {fieldError('title') && (
          <span id="ticket-title-error" className="error small">
            {fieldError('title')}
          </span>
        )}
      </div>
      <div className="field">
        <label htmlFor="ticket-body">Details</label>
        <textarea
          id="ticket-body"
          name="body"
          rows={4}
          maxLength={TICKET_LIMITS.bodyMax}
          aria-invalid={fieldError('body') ? true : undefined}
          aria-describedby={fieldError('body') ? 'ticket-body-error' : undefined}
        />
        {fieldError('body') && (
          <span id="ticket-body-error" className="error small">
            {fieldError('body')}
          </span>
        )}
      </div>
      <div>
        <button type="submit" disabled={pending}>
          {pending ? 'Filing…' : 'File ticket'}
        </button>
      </div>
      <p role="status" className={state?.ok ? 'ok' : 'error'}>
        {state ? (state.ok ? state.message : state.field ? '' : state.error) : ''}
      </p>
    </form>
  );
}
