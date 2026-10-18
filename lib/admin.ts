/**
 * The admin area's People and Activity actions (auth-kit/admin; primer §9). Server-only.
 *
 * Every action re-reads the acting person and the target from Cognito, runs the guardrails (the
 * site-wide roles, auth-kit ADR 0020: grant only below your own role, nobody changes their own role,
 * only the owner grants Super admin, the owner role moves only by Transfer ownership), asks for a
 * recent sign-in before a grant, a transfer, or a delete, and writes the audit intent before any
 * Cognito call and the result after (auth-kit ADR 0010, 0011).
 *
 * Created on first use, not at import: building it needs the public origin (for invite links),
 * which a production build doesn't have until it runs on its branch.
 */
import 'server-only';
import { createPeopleActions, type PeopleActions } from 'auth-kit/admin';
import { matrixOverrides } from '@/dev-matrix';
import { site } from '@/site.config';
import { alertOnPeopleChange } from './alerts';
import { auditLog } from './audit-log';
import { auth } from './auth';
import { createSiteMailer } from './email';
import { publicOrigin } from './origin';
import { outputs } from './outputs';
import { resourceActions } from './resource-actions';

let people: PeopleActions | undefined;

export function peopleActions(): PeopleActions {
  if (people) return people;
  const matrix = matrixOverrides();
  people = createPeopleActions({
    auth,
    auditLog: auditLog(),
    // Everyday pools invite with an emailed code: no password, no `email_verified`, and the app's own
    // email (Cognito's is suppressed), from the family's sender with its Reply-To and footer
    // (lib/email.ts). The same mailer sends the owner's alerts (a Super admin grant, an ownership
    // transfer). A Tier 3 admin pool uses inviteMode: 'temporary-password'.
    mailer: matrix?.mailer ?? createSiteMailer({ region: outputs.auth.aws_region }),
    siteName: site.name,
    signInUrl: `${publicOrigin()}/sign-in`,
    inviteDomains: site.inviteDomains,
    onChange: alertOnPeopleChange,
    // Disabling someone also removes their roles on projects (auth-kit/resources). It's never
    // blocked: a project left without a Manager is listed in the disable row, and admins who manage
    // people can still make someone its Manager.
    removeResourceMemberships: (person) => resourceActions().removeResourceMemberships(person),
    onError: (error, context) => console.error(`[admin] ${context}:`, error instanceof Error ? error.message : error),
    ...(matrix && { cognito: matrix.peopleCognito }),
  });
  return people;
}

/** Where the admin UI sends someone whose sign-in is too old for a risky action (step-up). */
export function stepUpHref(returnTo: string): string {
  return `/sign-in?${new URLSearchParams({ next: returnTo, reauth: '1' }).toString()}`;
}
