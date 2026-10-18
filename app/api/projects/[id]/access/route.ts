/**
 * Who has access to one project. GET: anyone who can see the project. PUT `{ email, role }`: give
 * an existing account this role (add, or change; no change if it already is), for its Managers and
 * site admins who manage people; auth-kit re-reads the acting person live, keeps at least one
 * Manager, and logs intent and result. A Manager's invite for someone new is the page's form only.
 */
import { assertSameOrigin, NotFoundError, PRIVATE_NO_STORE, withAuthErrors } from 'auth-kit/server';
import { actionResponse } from '@/lib/action-response';
import { auth } from '@/lib/auth';
import { expectedOrigin } from '@/lib/origin';
import { resourceActions } from '@/lib/resource-actions';

const NO_STORE = { 'Cache-Control': PRIVATE_NO_STORE };

export const GET = withAuthErrors(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await auth.requireResourceRole('project', id, 'view', { request });
  const list = await resourceActions().listAccess({ type: 'project', id });
  if (list.state === 'not_found') throw new NotFoundError();
  if (list.state === 'unavailable') return Response.json({ error: 'unavailable', message: list.reason }, { status: 503, headers: { ...NO_STORE, 'Retry-After': '5' } });
  return Response.json({ members: list.members, managers: list.managers, viewer: list.viewer }, { headers: NO_STORE });
});

export const PUT = withAuthErrors(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await auth.requireUser({ request });
  assertSameOrigin(request, { expectedOrigin: expectedOrigin() });
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return Response.json({ error: 'unsupported_media_type', message: 'Send JSON.' }, { status: 415, headers: NO_STORE });
  }
  const body = (await request.json().catch(() => null)) as { email?: unknown; role?: unknown } | null;
  // auth-kit validates the address and the role, and answers 404 to anyone who can't see the project.
  return actionResponse(await resourceActions().grant({ type: 'project', id, email: body?.email as string, role: body?.role as never }));
});
