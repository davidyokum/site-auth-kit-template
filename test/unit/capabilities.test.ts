import { ROLE_MATRIX, ROLE_MATRIX_CAPABILITIES, STANDARD_CAPABILITIES, STANDARD_GROUPS } from 'auth-kit/server';
import { describe, expect, it } from 'vitest';
import { capabilities } from '@/lib/capabilities';
import { site } from '@/site.config';

const can = (groups: string[], capability: Parameters<typeof capabilities.can>[1]) => capabilities.can(groups, capability);

describe('the capability map (lib/capabilities.ts)', () => {
  it('maps every site-wide role, in ladder order, and every app role', () => {
    expect(capabilities.groups.slice(0, STANDARD_GROUPS.length)).toEqual([...STANDARD_GROUPS]);
    for (const group of [...STANDARD_GROUPS, ...site.appRoles]) expect(capabilities.groups).toContain(group);
  });

  it('keeps the standard capabilities of each role', () => {
    for (const group of STANDARD_GROUPS) {
      for (const capability of STANDARD_CAPABILITIES[group]) expect(can([group], capability)).toBe(true);
    }
  });

  it('is a ladder: each role holds everything the role below it holds', () => {
    for (let i = 0; i < STANDARD_GROUPS.length - 1; i++) {
      const higher = capabilities.capabilitiesOf([STANDARD_GROUPS[i]!]);
      for (const capability of capabilities.capabilitiesOf([STANDARD_GROUPS[i + 1]!])) expect(higher.has(capability)).toBe(true);
    }
  });

  it('gives a member with no group nothing; items reach them through access to the item instead', () => {
    expect(capabilities.capabilitiesOf([]).size).toBe(0);
  });

  it('grants nothing for an unknown, misspelled, or retired group', () => {
    expect(capabilities.capabilitiesOf(['Owner', 'admin', 'editor', 'viewer', ' superadmin', 'superadmins']).size).toBe(0);
  });

  it('keeps content and people apart: content-only and view-only admins never manage people', () => {
    for (const group of ['admin-content', 'admin-view']) {
      expect(can([group], 'people.manage')).toBe(false);
      expect(can([group], 'roles.manage')).toBe(false);
      expect(can([group], 'tickets.read-all')).toBe(false);
    }
    expect(can(['admin-view'], 'content.edit')).toBe(false);
    expect(can(['admin-content-people'], 'people.manage')).toBe(true);
  });

  it('lets every admin role see the admin area (people.read, audit.read)', () => {
    for (const group of STANDARD_GROUPS) {
      expect(can([group], 'people.read')).toBe(true);
      expect(can([group], 'audit.read')).toBe(true);
    }
  });

  it('gives security settings, exports, and deletion to the owner and Super admins, and owner-only powers to the owner', () => {
    for (const capability of ['settings.security', 'data.export', 'data.delete'] as const) {
      expect(capabilities.groupsWith(capability)).toEqual(['owner', 'superadmin']);
    }
    expect(capabilities.groupsWith('owner.private')).toEqual(['owner']);
    expect(capabilities.groupsWith('owner.transfer')).toEqual(['owner']);
  });

  it('lets staff (people admins and up) see every ticket, and nobody else', () => {
    expect([...capabilities.groupsWith('tickets.read-all')]).toEqual(['owner', 'superadmin', 'admin-content-people']);
  });
});

describe('the role grid (auth-kit ROLE_MATRIX) agrees with this site’s map', () => {
  it('says yes exactly where lib/capabilities.ts grants every capability the column stands for', () => {
    for (const row of ROLE_MATRIX.rows) {
      const held = row.role === 'member' ? new Set<string>() : new Set<string>(capabilities.capabilitiesOf([row.role]));
      for (const column of ROLE_MATRIX.columns) {
        expect(row.cells[column].allowed, `${row.label}: ${column}`).toBe(ROLE_MATRIX_CAPABILITIES[column].every((c) => held.has(c)));
      }
    }
  });

  it('matches the grid in the README', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const readme = readFileSync(join(import.meta.dirname, '..', '..', 'README.md'), 'utf8');
    for (const row of ROLE_MATRIX.rows) {
      const line = readme.split('\n').find((l) => l.startsWith(`| ${row.label}`));
      expect(line, `README row for ${row.label}`).toBeDefined();
      const cells = line!.split('|').slice(2, 2 + ROLE_MATRIX.columns.length + 1).map((c) => c.trim());
      // Column 0 is the group; then one cell per matrix column, starting "Yes" when allowed.
      ROLE_MATRIX.columns.forEach((column, i) => {
        expect(/^(Yes|Roles below)/.test(cells[i + 1]!), `${row.label}: ${column} is "${cells[i + 1]}"`).toBe(row.cells[column].allowed);
      });
    }
  });
});
