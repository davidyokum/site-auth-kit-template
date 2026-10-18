/**
 * Access to one project: who has access, add, change a role, remove (or leave), a Manager's invite
 * for someone new (access to that one project only; the site's admins are alerted), creating a
 * project with its first Manager, and the People page's disable hook (auth-kit/resources). Each
 * re-reads the acting person live, checks their access to the project, keeps at least one Manager,
 * and writes the audit intent before the change and the result after. Server-only.
 *
 * Created on first use, not at import: building it needs the public origin (for invite links),
 * which a production build doesn't have until it runs on its branch.
 */
import 'server-only';
import { createResourceActions, type ResourceActions } from 'auth-kit/resources';
import { matrixOverrides } from '@/dev-matrix';
import { site } from '@/site.config';
import { accountMailer } from './accounts';
import { auditLog } from './audit-log';
import { auth } from './auth';
import type { SiteMailer } from './email';
import { publicOrigin } from './origin';
import { projectStore } from './projects';

let actions: ResourceActions | undefined;

export function resourceActions(): ResourceActions {
  if (actions) return actions;
  const matrix = matrixOverrides();
  actions = createResourceActions({
    auth,
    auditLog: auditLog(),
    // The invite email and the admins' alert, from the family's sender, in the card's layout with the
    // help address in effect (lib/email.ts). Under the matrix, auth-kit's mailer that sends nothing
    // (and its read-only Cognito changes no accounts).
    mailer: matrix?.mailer ?? (accountMailer() as SiteMailer),
    siteName: site.name,
    signInUrl: `${publicOrigin()}/sign-in`,
    inviteDomains: site.inviteDomains,
    // The project's name for the invite email and the alert: from the store, never from the request.
    resourceName: async ({ type, id }) => (type === 'project' ? (await projectStore().get(id))?.name : undefined),
    onError: (error, context) => console.error(`[resources] ${context}:`, error instanceof Error ? error.message : error),
    ...(matrix && { cognito: matrix.peopleCognito }),
  });
  return actions;
}
