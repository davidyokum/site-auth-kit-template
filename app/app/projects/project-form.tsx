'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { PROJECT_LIMITS } from '@/lib/projects/types';
import type { ProjectFormState } from './actions';

export function ProjectForm({
  action,
  chooseManager,
}: {
  action: (previous: ProjectFormState | null, data: FormData) => Promise<ProjectFormState>;
  /** Site admins who manage people choose the Manager; self-service creators manage it themselves. */
  chooseManager: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const fieldError = (field: 'name' | 'summary' | 'managerEmail') => (state && !state.ok && state.field === field ? state.error : null);
  return (
    <form action={formAction} className="card stack" aria-labelledby="new-project-heading">
      <h2 id="new-project-heading">New project</h2>
      <div className="field">
        <label htmlFor="project-name">Name</label>
        <input id="project-name" name="name" required maxLength={PROJECT_LIMITS.nameMax} aria-invalid={fieldError('name') ? true : undefined} aria-describedby={fieldError('name') ? 'project-name-error' : undefined} />
        {fieldError('name') && (
          <span id="project-name-error" className="error small">
            {fieldError('name')}
          </span>
        )}
      </div>
      <div className="field">
        <label htmlFor="project-summary">Summary</label>
        <textarea id="project-summary" name="summary" rows={3} maxLength={PROJECT_LIMITS.summaryMax} aria-invalid={fieldError('summary') ? true : undefined} />
      </div>
      {chooseManager ? (
        <div className="field">
          <label htmlFor="project-manager">Manager’s email (leave empty to manage it yourself)</label>
          <input id="project-manager" name="managerEmail" type="email" maxLength={254} autoComplete="off" spellCheck={false} aria-invalid={fieldError('managerEmail') ? true : undefined} aria-describedby="project-manager-hint" />
          <span id="project-manager-hint" className="muted small">
            They need an account (invite them from the People page first). The Manager edits the project and chooses who else has access.
          </span>
        </div>
      ) : (
        <p className="muted small">You’ll be its Manager: you can share it once it exists.</p>
      )}
      <div>
        <button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create project'}
        </button>
      </div>
      <p role="status" className={state?.ok ? 'ok' : 'error'}>
        {state ? (state.ok ? state.message : state.field === 'name' || state.field === 'summary' ? '' : state.error) : ''}
        {state?.ok ? (
          <>
            {' '}
            <Link href={`/app/projects/${state.projectId}`}>Open it</Link>
          </>
        ) : null}
      </p>
    </form>
  );
}
