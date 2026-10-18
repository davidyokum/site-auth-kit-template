/**
 * One project by ID. Both handlers check access to this project first (`requireResourceRole`): no
 * access at all is 404, the same answer as a project that doesn't exist; seeing it but not being
 * allowed to edit it is 403. Edits re-read the person live and are audited and conditional.
 */
import { assertSameOrigin, NotFoundError, PRIVATE_NO_STORE, withAuthErrors } from 'auth-kit/server';
import { auth } from '@/lib/auth';
import { expectedOrigin } from '@/lib/origin';
import { projectStore, validateProjectInput } from '@/lib/projects';
import { updateProject } from '@/lib/projects/service';

const NO_STORE = { 'Cache-Control': PRIVATE_NO_STORE };

export const GET = withAuthErrors(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const access = await auth.requireResourceRole('project', id, 'view', { request });
  const project = await projectStore().get(id);
  if (!project) throw new NotFoundError();
  return Response.json({ project, access: { role: access.role, actions: [...access.actions] } }, { headers: NO_STORE });
});

export const PATCH = withAuthErrors(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  // Live: a site admin demoted a moment ago no longer edits by their old token's floor.
  const access = await auth.requireResourceRole('project', id, 'edit', { request, live: true });
  assertSameOrigin(request, { expectedOrigin: expectedOrigin() });
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return Response.json({ error: 'unsupported_media_type', message: 'Send JSON.' }, { status: 415, headers: NO_STORE });
  }
  const current = await projectStore().get(id);
  if (!current) throw new NotFoundError();
  const body = (await request.json().catch(() => null)) as { name?: unknown; summary?: unknown; updatedAt?: unknown } | null;
  const input = validateProjectInput({ name: body?.name ?? current.name, summary: body?.summary ?? current.summary });
  if (!input.ok) return Response.json({ error: 'invalid_input', field: input.field, message: input.error }, { status: 400, headers: NO_STORE });
  const expected = typeof body?.updatedAt === 'string' ? body.updatedAt : current.updatedAt;
  const result = await updateProject(access.user, current, input, expected);
  if (result.ok) return Response.json({ project: result.project, ...(!result.outcomeLogged && { warning: 'audit_incomplete' }) }, { headers: NO_STORE });
  const status = result.reason === 'conflict' ? 409 : result.reason === 'not_found' ? 404 : 503;
  return Response.json({ error: result.reason, message: result.message }, { status, headers: { ...NO_STORE, ...(status === 503 && { 'Retry-After': '5' }) } });
});
