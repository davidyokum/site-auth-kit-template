/**
 * The sample API: GET lists projects (the ones this person has a role on, or every project for a
 * site role that sees every item); POST creates one (site admins who manage people, unless the site
 * turns on self-service creation; lib/resources.ts). Each handler checks the person itself (the
 * proxy is never the only gate), answers 401/403/404/503 through `withAuthErrors`, and is never cached.
 */
import { assertSameOrigin, PRIVATE_NO_STORE, withAuthErrors } from 'auth-kit/server';
import { actionResponse } from '@/lib/action-response';
import { auth } from '@/lib/auth';
import { expectedOrigin } from '@/lib/origin';
import { listLimit, projectStore, validateProjectInput } from '@/lib/projects';
import { createProject } from '@/lib/projects/service';

const NO_STORE = { 'Cache-Control': PRIVATE_NO_STORE };

export const GET = withAuthErrors(async (request: Request) => {
  const user = await auth.requireUser({ request });
  const limit = listLimit(new URL(request.url).searchParams.get('limit'));
  // Filtered on the server: a member's list never contains a project they have no role on.
  const mine = await auth.listMyResources('project', { user });
  const store = projectStore();
  const projects = mine.scope === 'all' ? await store.listRecent(limit) : await store.getMany(mine.items.map((i) => i.id));
  const roles: Record<string, string> = mine.scope === 'all' ? Object.fromEntries(mine.roles) : Object.fromEntries(mine.items.map((i) => [i.id, i.role]));
  return Response.json({ scope: mine.scope, projects: projects.map((p) => ({ ...p, role: roles[p.id] ?? null })) }, { headers: NO_STORE });
});

export const POST = withAuthErrors(async (request: Request) => {
  const user = await auth.requireUser({ request });
  // A state change must come from this site's own pages (403 origin_mismatch otherwise).
  assertSameOrigin(request, { expectedOrigin: expectedOrigin() });
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return Response.json({ error: 'unsupported_media_type', message: 'Send JSON.' }, { status: 415, headers: NO_STORE });
  }
  const body = (await request.json().catch(() => null)) as { name?: unknown; summary?: unknown; managerEmail?: unknown } | null;
  const input = validateProjectInput(body ?? {});
  if (!input.ok) return Response.json({ error: 'invalid_input', field: input.field, message: input.error }, { status: 400, headers: NO_STORE });
  const managerEmail = typeof body?.managerEmail === 'string' && body.managerEmail.trim() !== '' ? body.managerEmail.trim() : undefined;
  // auth-kit decides, live, whether this person may create one and whom they may make its Manager.
  const result = await createProject(user, { ...input, ...(managerEmail !== undefined && { managerEmail }) });
  if (!result.ok) return actionResponse(result);
  return Response.json({ project: result.value, message: result.message }, { status: 201, headers: NO_STORE });
});
