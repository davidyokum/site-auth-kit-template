/**
 * auth-kit's action results as HTTP answers, for API routes that call the access actions. The
 * result's `changed` tells the caller honestly whether anything happened, so it goes in the body.
 */
import type { ActionResult } from 'auth-kit/admin';
import { PRIVATE_NO_STORE } from 'auth-kit/server';

const STATUS: Record<Extract<ActionResult, { ok: false }>['code'], number> = {
  unauthenticated: 401,
  step_up_required: 401,
  forbidden: 403,
  not_found: 404,
  invalid: 400,
  refused: 409,
  stale: 409,
  audit_unavailable: 503,
  unavailable: 503,
  audit_incomplete: 200,
  failed: 502,
};

export function actionResultStatus(result: ActionResult): number {
  return result.ok ? 200 : STATUS[result.code];
}

export function actionResponse(result: ActionResult, okStatus = 200): Response {
  const headers = { 'Cache-Control': PRIVATE_NO_STORE, ...(!result.ok && result.code === 'audit_unavailable' && { 'Retry-After': '5' }) };
  if (result.ok) return Response.json({ message: result.message }, { status: okStatus, headers });
  return Response.json({ error: result.code, message: result.error, changed: result.changed, ...(result.guardrail && { guardrail: result.guardrail }) }, { status: STATUS[result.code], headers });
}
