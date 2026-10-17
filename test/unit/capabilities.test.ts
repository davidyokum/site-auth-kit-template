import { STANDARD_CAPABILITIES, STANDARD_GROUPS } from 'auth-kit/server';
import { describe, expect, it } from 'vitest';
import { capabilities } from '@/lib/capabilities';
import { site } from '@/site.config';

const can = (groups: string[], capability: Parameters<typeof capabilities.can>[1]) => capabilities.can(groups, capability);

describe('the capability map (lib/capabilities.ts)', () => {
  it('maps every standard group, and every app role', () => {
    for (const group of [...STANDARD_GROUPS, ...site.appRoles]) expect(capabilities.groups).toContain(group);
  });

  it('keeps the standard capabilities of each standard group', () => {
    for (const group of STANDARD_GROUPS) {
      for (const capability of STANDARD_CAPABILITIES[group]) expect(can([group], capability)).toBe(true);
    }
  });

  it('gives a member with no group nothing; records reach them through ownership instead', () => {
    expect(capabilities.capabilitiesOf([]).size).toBe(0);
  });

  it('grants nothing for an unknown or misspelled group', () => {
    expect(capabilities.capabilitiesOf(['Admin', 'owner', ' admin', 'superadmins']).size).toBe(0);
  });

  it('keeps content and people apart: editors and viewers never manage people', () => {
    for (const group of ['editor', 'viewer']) {
      expect(can([group], 'people.manage')).toBe(false);
      expect(can([group], 'roles.manage')).toBe(false);
      expect(can([group], 'tickets.read-all')).toBe(false);
    }
    expect(can(['admin'], 'people.manage')).toBe(true);
  });

  it('gives security settings, exports, and deletion to owners alone', () => {
    for (const capability of ['settings.security', 'data.export', 'data.delete'] as const) {
      expect(capabilities.groupsWith(capability)).toEqual(['superadmin']);
    }
  });

  it('lets staff (admin, owner) see every ticket, and nobody else', () => {
    expect([...capabilities.groupsWith('tickets.read-all')].sort()).toEqual(['admin', 'superadmin']);
  });
});
