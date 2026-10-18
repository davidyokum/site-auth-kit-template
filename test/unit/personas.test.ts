import { parsePersonas } from 'auth-kit/dev';
import { ADMIN_ROLE_LABEL, STANDARD_GROUPS } from 'auth-kit/server';
import { describe, expect, it } from 'vitest';
import personas from '@/personas.json';
import { site } from '@/site.config';

describe('personas.json (the only list of localhost test accounts)', () => {
  const parsed = parsePersonas(personas, { appRoles: site.appRoles });

  it('passes auth-kit’s checks: every admin role, a member, .test addresses, no passwords', () => {
    expect(parsed.length).toBe(personas.length);
    for (const p of personas) expect(Object.keys(p).sort()).not.toContain('password');
  });

  it('has one persona per site-wide role (exactly one owner) and a second member for item tests', () => {
    const roles = parsed.map((p) => p.groups[0] ?? 'member');
    for (const role of STANDARD_GROUPS) expect(roles).toContain(role);
    expect(roles.filter((r) => r === 'owner')).toHaveLength(1);
    expect(roles.filter((r) => r === 'member').length).toBeGreaterThanOrEqual(2);
  });

  it('labels each admin persona with its role’s screen name', () => {
    for (const p of parsed) {
      const role = p.groups.find((g): g is (typeof STANDARD_GROUPS)[number] => (STANDARD_GROUPS as readonly string[]).includes(g));
      if (role) expect(p.label).toBe(ADMIN_ROLE_LABEL[role]);
    }
  });

  it('covers every app role', () => {
    for (const role of site.appRoles) expect(parsed.some((p) => p.groups.includes(role))).toBe(true);
  });
});
