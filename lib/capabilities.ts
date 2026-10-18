/**
 * The ONLY place group names appear (03 §2: "code checks capabilities, mapped from groups in one
 * file, never role names scattered through routes"; auth-kit ADR 0003).
 *
 * Routes, pages, and server actions ask `requireCan('people.manage')`, never "is she an admin?".
 *
 * - Groups come only from Cognito: the site-wide roles (auth-kit ADR 0020), highest first, then app
 *   roles (`appRoles` in site.config.ts). Unknown groups grant nothing.
 *     owner                 Owner (only one): everything, plus owner-only pages and Transfer ownership
 *     superadmin            Super admin: everything but owner-only (security, exports, deletion)
 *     admin-content-people  Admin – content & people: any content, people and roles below their own
 *     admin-content         Admin – content only: any content, site-wide
 *     admin-view            Admin – view only: sees the admin area and all content, changes nothing
 * - Each role includes everything below it, so app capabilities are added at the lowest role that
 *   should have them and spread upward.
 * - A member with no group holds no capabilities. Members still sign in (`requireUser`) and reach
 *   their projects, because project routes check access to the project (`requireResourceRole`: their
 *   resource role there, Manager, Contributor, or Reader; lib/resources.ts), not site roles.
 * - The same capabilities are the site role's floor on every project (auth-kit `RESOURCE_SITE_FLOOR`):
 *   `content.read` sees every project, `content.edit` edits every project, `people.manage` chooses who
 *   has access to every project. So a capability given here reaches every item, too.
 */
import { type CapabilityOf, defineCapabilities, STANDARD_CAPABILITIES } from 'auth-kit/server';

export const capabilities = defineCapabilities({
  owner: [...STANDARD_CAPABILITIES.owner],
  superadmin: [...STANDARD_CAPABILITIES.superadmin],
  'admin-content-people': [...STANDARD_CAPABILITIES['admin-content-people']],
  'admin-content': [...STANDARD_CAPABILITIES['admin-content']],
  'admin-view': [...STANDARD_CAPABILITIES['admin-view']],
  // An app role, e.g.: reviewer: ['reviews.read', 'reviews.comment'],
});

export type Capability = CapabilityOf<typeof capabilities>;
