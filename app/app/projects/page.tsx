/**
 * Projects: the ones this person has a role on (`listMyResources`), or every project for a site role
 * that sees every item (Admin – view only and up). The list comes from the server, filtered before
 * it's read; a failed load says why. Site admins who manage people create projects and choose each
 * one's Manager (lib/resources.ts has the switch for self-service creation).
 */
import { AuthUnavailableError } from 'auth-kit/server';
import { createPermission, type ResourceRole } from 'auth-kit/resources';
import { ResourceRoleChip } from 'auth-kit/resources/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { auth, pages } from '@/lib/auth';
import { type Project, projectStore } from '@/lib/projects';
import { resourceTypes } from '@/lib/resources';
import { createProjectAction } from './actions';
import { ProjectForm } from './project-form';

export const metadata: Metadata = { title: 'Projects' };

type Loaded = { projects: Project[]; roles: ReadonlyMap<string, ResourceRole>; scope: 'all' | 'mine'; truncated: boolean } | { error: string };

async function loadProjects(user: Awaited<ReturnType<typeof pages.requireUser>>): Promise<Loaded> {
  try {
    const mine = await auth.listMyResources('project', { user });
    const store = projectStore();
    if (mine.scope === 'all') return { projects: await store.listRecent(), roles: mine.roles, scope: 'all', truncated: mine.truncated };
    return {
      projects: await store.getMany(mine.items.map((i) => i.id)),
      roles: new Map(mine.items.map((i) => [i.id, i.role])),
      scope: 'mine',
      truncated: mine.truncated,
    };
  } catch (error) {
    // Honest data: a failed load says why; it never renders as "no projects".
    if (error instanceof AuthUnavailableError) return { error: 'your access to projects couldn’t be checked right now.' };
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export default async function ProjectsPage() {
  const user = await pages.requireUser();
  const result = await loadProjects(user);
  // What to offer. createProjectAction checks again, live, on the server.
  const permission = createPermission(resourceTypes.get('project'), user.capabilities);

  return (
    <div className="stack">
      <h1>Projects</h1>
      {'error' in result ? (
        <p className="notice notice-error" role="alert">
          — Couldn&apos;t load projects: {result.error}
        </p>
      ) : (
        <>
          <p className="muted">
            {result.scope === 'all'
              ? 'You can see every project (your site role). Your own role on a project shows beside it.'
              : 'The projects you have a role on. Site admins can see every project.'}
          </p>
          {result.projects.length === 0 ? (
            <p className="muted">{result.scope === 'all' ? 'No projects yet.' : 'You don’t have a role on any project yet.'}</p>
          ) : (
            <ul className="list">
              {result.projects.map((project) => {
                const role = result.roles.get(project.id);
                return (
                  <li key={project.id}>
                    <Link href={`/app/projects/${project.id}`}>{project.name}</Link> {role ? <ResourceRoleChip role={role} /> : null}
                  </li>
                );
              })}
            </ul>
          )}
          {result.truncated ? <p className="muted small">The list stopped at the first {result.projects.length}.</p> : null}
        </>
      )}
      {permission.allowed ? (
        <ProjectForm action={createProjectAction} chooseManager={permission.manager === 'anyone'} />
      ) : (
        <p className="muted small">{permission.reason}</p>
      )}
    </div>
  );
}
