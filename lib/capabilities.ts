/**
 * The ONLY place group names appear (03 §2: "code checks capabilities, mapped from groups in one
 * file, never role names scattered through routes"; auth-kit ADR 0003).
 *
 * Routes, pages, and server actions ask `requireCan('tickets.read-all')`, never "is she an admin?".
 * Splitting a role later (say, content admins from people admins) is then a change to this file.
 *
 * - Groups come only from Cognito: superadmin (shown as Owner), admin, editor, viewer, then app roles
 *   (`appRoles` in amplify/auth/resource.ts). Unknown groups grant nothing.
 * - A member with no group holds no capabilities. Members still sign in (`requireUser`) and reach
 *   their own records, because record routes check ownership (`requireRecordAccess`), not roles.
 * - Content and people are separate keys: editors hold content only, admins add People, owners alone
 *   hold security settings, exports, and deletion. Keep that split when you add your own.
 */
import { type CapabilityOf, defineCapabilities, STANDARD_CAPABILITIES } from 'auth-kit/server';

export const capabilities = defineCapabilities({
  // `tickets.read-all`: see every ticket, not just your own (the sample app's staff view).
  superadmin: [...STANDARD_CAPABILITIES.superadmin, 'tickets.read-all'],
  admin: [...STANDARD_CAPABILITIES.admin, 'tickets.read-all'],
  editor: [...STANDARD_CAPABILITIES.editor],
  viewer: [...STANDARD_CAPABILITIES.viewer],
  // An app role, e.g.: reviewer: ['reviews.read', 'reviews.comment'],
});

export type Capability = CapabilityOf<typeof capabilities>;
