/**
 * Starter Guarded Role Builder catalog (auth-kit ADR 0031).
 *
 * Declares the site's visible tabs, app actions, and code-locked administration capabilities.
 * Sites customize `STARTER_ROLE_CATALOG` as they add tabs or domain actions; governance roles
 * (`owner`, `superadmin`) and administration capabilities remain permanently code-locked.
 */
import type { RoleCapabilityDef, RolePolicyCatalog, RolePolicyDefinition } from 'auth-kit/admin';

export const STARTER_CAPABILITIES: readonly RoleCapabilityDef[] = Object.freeze([
  {
    id: 'tab.home',
    label: 'Home',
    group: 'tabs',
    locked: false,
    plainDescription: 'See the main workspace overview page after signing in.',
    technicalNote: 'Checked on /app via effective role policy.',
  },
  {
    id: 'tab.projects',
    label: 'Projects',
    group: 'tabs',
    locked: false,
    plainDescription: 'Open the Projects tab and browse items you have been granted access to.',
    technicalNote: 'Checked on /app/projects alongside item-level resource roles.',
  },
  {
    id: 'content.edit',
    label: 'Edit content',
    group: 'actions',
    locked: false,
    plainDescription: 'Edit shared content across the workspace, not only items you manage.',
    technicalNote: 'Enforced live on mutation endpoints and server actions.',
  },
  {
    id: 'content.publish',
    label: 'Publish updates',
    group: 'actions',
    locked: false,
    plainDescription: 'Publish drafts or finalize shared changes for all signed-in users.',
    technicalNote: 'Enforced live via content.publish capability.',
  },
  {
    id: 'people.read',
    label: 'Admin & Audit',
    group: 'admin',
    locked: true,
    plainDescription: 'Open Admin Mode to inspect People, Role Matrix, and the append-only Audit Log.',
    technicalNote: 'Code-locked. Checked live via pages.requireCan("people.read", { live: true }).',
  },
  {
    id: 'people.manage',
    label: 'Invite & Roles',
    group: 'admin',
    locked: true,
    plainDescription: 'Invite new users, change roles below your own, and disable or re-enable accounts.',
    technicalNote: 'Code-locked. Checked live via people.manage + roles.manage guardrails.',
  },
  {
    id: 'settings.security',
    label: 'Settings & Delete',
    group: 'admin',
    locked: true,
    plainDescription: 'Change sign-in help, edit role policies, customize invite copy, and delete disabled accounts.',
    technicalNote: 'Code-locked. Requires Super admin or Owner with recent sign-in step-up.',
  },
  {
    id: 'owner.transfer',
    label: 'Owner Only',
    group: 'admin',
    locked: true,
    plainDescription: 'Grant Admin (superadmin), open owner-only pages, and transfer site ownership.',
    technicalNote: 'Code-locked. Single break-glass Owner account only.',
  },
]);

export const STARTER_BUILT_IN_ROLES: readonly RolePolicyDefinition[] = Object.freeze([
  {
    id: 'owner',
    label: 'Owner',
    summary: 'Single break-glass site owner; grants Admin and transfers ownership.',
    kind: 'governance',
    locked: true,
    defaultCapabilities: [
      'tab.home',
      'tab.projects',
      'content.edit',
      'content.publish',
      'people.read',
      'people.manage',
      'settings.security',
      'owner.transfer',
    ],
  },
  {
    id: 'superadmin',
    label: 'Admin',
    summary: 'Full day-to-day site administration, people, role policies, and security settings.',
    kind: 'governance',
    locked: true,
    defaultCapabilities: [
      'tab.home',
      'tab.projects',
      'content.edit',
      'content.publish',
      'people.read',
      'people.manage',
      'settings.security',
    ],
  },
  {
    id: 'admin-content-people',
    label: 'Admin – content & people',
    summary: 'Legacy portal tier: invites and manages roles below their own plus all content.',
    kind: 'legacy',
    locked: true,
    defaultCapabilities: [
      'tab.home',
      'tab.projects',
      'content.edit',
      'content.publish',
      'people.read',
      'people.manage',
    ],
  },
  {
    id: 'admin-content',
    label: 'Admin – content only',
    summary: 'Legacy portal tier: edits and publishes all content with read-only Admin visibility.',
    kind: 'legacy',
    locked: true,
    defaultCapabilities: [
      'tab.home',
      'tab.projects',
      'content.edit',
      'content.publish',
      'people.read',
    ],
  },
  {
    id: 'admin-view',
    label: 'Admin – view only',
    summary: 'Legacy portal tier: read-only oversight across all content, People, and Audit Log.',
    kind: 'legacy',
    locked: true,
    defaultCapabilities: ['tab.home', 'tab.projects', 'people.read'],
  },
  {
    id: 'member',
    label: 'Viewer',
    summary: 'Default least-privilege account; views permitted workspace tabs without Admin access.',
    kind: 'baseline',
    locked: false,
    defaultCapabilities: ['tab.home', 'tab.projects'],
  },
]);

export const STARTER_ROLE_CATALOG: RolePolicyCatalog = Object.freeze({
  capabilities: STARTER_CAPABILITIES,
  builtInRoles: STARTER_BUILT_IN_ROLES,
  requireAtLeastOneTab: true,
});

export function displayRoleLabel(roleId: string | null | undefined, customLabels?: ReadonlyMap<string, string>): string {
  if (!roleId || roleId === 'member') return 'Viewer';
  if (roleId === 'owner') return 'Owner';
  if (roleId === 'superadmin') return 'Admin';
  const builtIn = STARTER_BUILT_IN_ROLES.find((r) => r.id === roleId);
  if (builtIn) return builtIn.label;
  return customLabels?.get(roleId) ?? roleId;
}
