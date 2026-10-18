/**
 * One project. The page checks access to this project before reading it: the person's role on it
 * (Manager, Contributor, Reader) or their site role's floor (`pages.requireResourceRole`). Anyone who
 * can't see it gets "not found" (404), never "forbidden": the page doesn't confirm the project
 * exists (03 §2 Enforcement). Editing needs `edit`; "Who has access" lets its Managers (and site
 * admins who manage people) change who has access, and anyone with a role leave.
 */
import { WhoHasAccess } from 'auth-kit/resources/ui';
import { ResourceRoleChip } from 'auth-kit/resources/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { stepUpHref } from '@/lib/admin';
import { pages } from '@/lib/auth';
import { projectStore } from '@/lib/projects';
import { resourceActions } from '@/lib/resource-actions';
import { site } from '@/site.config';
import { addMember, changeMemberRole, inviteToProject, removeMember, updateProjectAction } from './actions';
import { ProjectEditForm } from './edit-form';

export const metadata: Metadata = { title: 'Project' };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await pages.requireResourceRole('project', id, 'view');
  const project = await projectStore().get(id);
  if (!project) notFound();
  const accessList = await resourceActions().listAccess({ type: 'project', id });

  return (
    <article className="stack">
      <p>
        <Link href="/app/projects">← Projects</Link>
      </p>
      <h1>{project.name}</h1>
      <p className="muted small">
        Created {new Date(project.createdAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC ·{' '}
        {access.role ? (
          <>
            your role: <ResourceRoleChip role={access.role} />
          </>
        ) : (
          `you have no role here; your site role lets you see it${access.can('edit') ? ' and edit it' : ''}`
        )}
      </p>
      {/* Rendered as text: React escapes it. Never dangerouslySetInnerHTML with stored content. */}
      <p className="card">{project.summary || <span className="muted">No summary.</span>}</p>
      {access.can('edit') ? <ProjectEditForm action={updateProjectAction} project={{ id: project.id, name: project.name, summary: project.summary, updatedAt: project.updatedAt }} /> : null}
      <WhoHasAccess
        noun="project"
        access={accessList}
        actions={{ add: addMember, changeRole: changeMemberRole, remove: removeMember, invite: inviteToProject }}
        inviteDomains={site.inviteDomains}
        stepUpHref={stepUpHref(`/app/projects/${project.id}`)}
      />
    </article>
  );
}
