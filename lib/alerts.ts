/**
 * Grants and removals alert a named person (03 §2 Admin area). auth-kit's People actions call
 * `onChange` with each completed change's audit row; this decides which ones matter and emails
 * `site.alertEmails` through the site's mailer: the family's sender, the help address in effect as
 * Reply-To, and the card's layout and footer (lib/email.ts). Every alert is also logged, so it
 * reaches the server logs even before anyone is named.
 *
 * Super admin grants and ownership transfers get a second, separate alert from auth-kit itself (the
 * owner is emailed, or both owners for a transfer, and the change is undone if that email can't be
 * sent); that one isn't optional.
 */
import 'server-only';
import { type AuditEvent, isStandardGroup } from 'auth-kit/admin';
import { site } from '@/site.config';
import { accountMailer, signInHelp } from './accounts';
import { inCardLayout } from './email';
import { publicOrigin } from './origin';
import { siteTheme } from './theme';

/** The people changes a named person hears about: anything that grants or removes access. */
export function isGrantOrRemoval(event: Pick<AuditEvent, 'action' | 'after' | 'outcome'>): boolean {
  if (event.outcome === 'failed') return false;
  switch (event.action) {
    case 'people.changeRole':
    case 'people.transferOwnership':
    case 'people.disable':
    case 'people.enable':
    case 'people.delete':
      return true;
    case 'people.invite': {
      // An invite that grants an admin role (not a plain member or app role).
      const after = event.after as { adminRole?: unknown; role?: unknown } | undefined;
      const role = after?.adminRole ?? after?.role;
      return isStandardGroup(role);
    }
    default:
      return false;
  }
}

export function describeChange(event: AuditEvent): { subject: string; text: string } {
  const who = event.actor.email ?? event.actor.sub;
  const whom = event.target?.email ?? event.target?.sub ?? 'someone';
  const verb = event.action.replace(/^people\./, '');
  const lines = [
    `${who} ran "${verb}" on ${whom} in ${site.name}.`,
    '',
    `When: ${event.at}`,
    `Outcome: ${event.outcome ?? 'recorded'}`,
    ...(event.before !== undefined ? [`Before: ${JSON.stringify(event.before)}`] : []),
    ...(event.after !== undefined ? [`After: ${JSON.stringify(event.after)}`] : []),
    ...(event.reason ? [`Reason given: ${event.reason}`] : []),
    ...(event.context?.ip ? [`From: ${event.context.ip}`] : []),
    '',
    "If you didn't expect this, check the Activity page and disable the account that made the change.",
  ];
  return { subject: `${site.name}: ${verb} by ${who}`, text: lines.join('\n') };
}

/** auth-kit's `onChange` hook. Failures are reported to auth-kit's `onError`, never to the admin. */
export async function alertOnPeopleChange(event: AuditEvent): Promise<void> {
  if (!isGrantOrRemoval(event)) return;
  const { subject, text } = describeChange(event);
  console.warn(JSON.stringify({ alert: 'people-change', action: event.action, auditId: event.id, actor: event.actor.sub, target: event.target?.sub }));
  if (site.alertEmails.length === 0) return;
  const help = (await signInHelp().effective()).address;
  const email = inCardLayout({ subject, text }, { siteName: site.name, theme: siteTheme(site), signInUrl: `${publicOrigin()}/sign-in`, helpEmail: help });
  await accountMailer().sendEmail({ to: [...site.alertEmails], email, replyTo: [help] });
}
