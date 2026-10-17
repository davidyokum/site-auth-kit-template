import { parsePersonas } from 'auth-kit/dev';
import { describe, expect, it } from 'vitest';
import personas from '@/personas.json';
import { site } from '@/site.config';

describe('personas.json (the only list of localhost test accounts)', () => {
  const parsed = parsePersonas(personas, { appRoles: site.appRoles });

  it('passes auth-kit’s checks: every admin role, a member, .test addresses, no passwords', () => {
    expect(parsed.length).toBe(personas.length);
    for (const p of personas) expect(Object.keys(p).sort()).not.toContain('password');
  });

  it('has one persona per role (superadmin, admin, editor, viewer) and a second member for record tests', () => {
    const roles = parsed.map((p) => p.groups[0] ?? 'member');
    for (const role of ['superadmin', 'admin', 'editor', 'viewer']) expect(roles).toContain(role);
    expect(roles.filter((r) => r === 'member').length).toBeGreaterThanOrEqual(2);
  });

  it('covers every app role', () => {
    for (const role of site.appRoles) expect(parsed.some((p) => p.groups.includes(role))).toBe(true);
  });
});
