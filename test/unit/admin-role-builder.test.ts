import { validateRolePolicyDraft } from 'auth-kit/admin';
import { describe, expect, it } from 'vitest';
import { buildEmailPreviewCatalog } from '@/lib/admin-stores';
import { STARTER_ROLE_CATALOG, displayRoleLabel } from '@/lib/role-catalog';

describe('starter Guarded Role Builder catalog and Email Studio (ADR 0031)', () => {
  it('keeps Owner, Admin, and Administration capabilities code-locked while allowing Viewer and custom operational roles', () => {
    expect(displayRoleLabel('owner')).toBe('Owner');
    expect(displayRoleLabel('superadmin')).toBe('Admin');
    expect(displayRoleLabel('member')).toBe('Viewer');

    expect(
      validateRolePolicyDraft(STARTER_ROLE_CATALOG, {
        overrides: { superadmin: ['tab.home'] },
        customRoles: [],
      }).ok,
    ).toBe(false);

    expect(
      validateRolePolicyDraft(STARTER_ROLE_CATALOG, {
        overrides: { member: ['tab.home', 'people.manage'] },
        customRoles: [],
      }).ok,
    ).toBe(false);

    expect(
      validateRolePolicyDraft(STARTER_ROLE_CATALOG, {
        overrides: { member: ['tab.home'] },
        customRoles: [
          {
            id: 'reviewer',
            label: 'Reviewer',
            summary: 'Can view Home and Projects.',
            capabilities: ['tab.home', 'tab.projects'],
            createdAt: '2026-11-25T00:00:00.000Z',
          },
        ],
      }).ok,
    ).toBe(true);
  });

  it('builds deterministic pure-DOM email previews reflecting custom invite welcome copy', () => {
    const previews = buildEmailPreviewCatalog({
      siteName: 'Example Site',
      helpEmail: 'help@example.org',
      signInUrl: 'https://app.example.org/sign-in',
      welcomeNote: 'Welcome aboard! Sign in using your work email.',
    });
    expect(previews.length).toBeGreaterThanOrEqual(7);
    expect(previews[0]?.paragraphs[0]).toBe('Welcome aboard! Sign in using your work email.');
    expect(previews[0]?.footer).toContain('help@example.org');
  });
});
