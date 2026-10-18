'use client';
import { useActionState } from 'react';
import { PROJECT_LIMITS } from '@/lib/projects/types';
import type { ProjectEditState } from './actions';

export function ProjectEditForm({
  action,
  project,
}: {
  action: (previous: ProjectEditState | null, data: FormData) => Promise<ProjectEditState>;
  project: { id: string; name: string; summary: string; updatedAt: string };
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const fieldError = (field: 'name' | 'summary') => (state && !state.ok && state.field === field ? state.error : null);
  return (
    <details className="card">
      <summary>Edit this project</summary>
      <form action={formAction} className="stack">
        <input type="hidden" name="id" value={project.id} />
        {/* The version you're editing: a save after someone else's is refused, not silently lost. */}
        <input type="hidden" name="updatedAt" value={project.updatedAt} />
        <div className="field">
          <label htmlFor="edit-name">Name</label>
          <input id="edit-name" name="name" required maxLength={PROJECT_LIMITS.nameMax} defaultValue={project.name} aria-invalid={fieldError('name') ? true : undefined} />
        </div>
        <div className="field">
          <label htmlFor="edit-summary">Summary</label>
          <textarea id="edit-summary" name="summary" rows={4} maxLength={PROJECT_LIMITS.summaryMax} defaultValue={project.summary} />
        </div>
        <div>
          <button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p role="status" className={state?.ok ? 'ok' : 'error'}>
          {state ? (state.ok ? state.message : state.error) : ''}
        </p>
      </form>
    </details>
  );
}
