/**
 * The ONLY place group names appear (03 §2: "code checks capabilities, mapped from groups in one
 * file, never role names scattered through routes"; auth-kit ADR 0003).
 *
 * Routes, pages, and server actions ask `requireCan('tickets.read-all')`, never "is she an admin?".
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
 *   their own items, because item routes check access to the item (`requireRecordAccess`), not roles.
 */
import { type CapabilityOf, defineCapabilities, STANDARD_CAPABILITIES } from 'auth-kit/server';

// `tickets.read-all`: see every ticket, not just your own (the sample app's staff view). Tickets are
// members' own items, not site content, so content-only and view-only admins don't get it.
const STAFF = ['tickets.read-all'] as const;

export const capabilities = defineCapabilities({
  owner: [...STANDARD_CAPABILITIES.owner, ...STAFF],
  superadmin: [...STANDARD_CAPABILITIES.superadmin, ...STAFF],
  'admin-content-people': [...STANDARD_CAPABILITIES['admin-content-people'], ...STAFF],
  'admin-content': [...STANDARD_CAPABILITIES['admin-content']],
  'admin-view': [...STANDARD_CAPABILITIES['admin-view']],
  // An app role, e.g.: reviewer: ['reviews.read', 'reviews.comment'],
});

export type Capability = CapabilityOf<typeof capabilities>;
