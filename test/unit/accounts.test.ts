/**
 * lib/accounts.ts follows the site's account-creation mode: an invite-only site (the template) has no
 * sign-up or request routes and no request queue, and its members' own email change and delete are
 * refused (admins change accounts there). The help address in effect falls back to the configured one
 * when the settings table can't be read, and says why.
 */
import { createMemoryAuditLog } from 'auth-kit/admin';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { takesSignUps } from '@/lib/account-modes';
import { accessRequests, accountRoutes, effectiveHelp, selfService } from '@/lib/accounts';
import { site } from '@/site.config';
import { helpAddressFor } from '@/site.families';

// The CI outputs have no tables; the refusals below never reach the log anyway.
vi.mock('@/lib/audit-log', () => ({ auditLog: () => createMemoryAuditLog() }));

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', 'https://www.example.com');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe.runIf(site.accountCreation.mode === 'invite')('on an invite-only site', () => {
  it('there are no sign-up or request routes, and no request queue', () => {
    expect(() => accountRoutes()).toThrow(/has no sign-up or request routes/);
    expect(accessRequests()).toBeNull();
  });

  it('members’ own email change and delete are refused before anything is read', async () => {
    expect(takesSignUps(site.accountCreation)).toBe(false);
    expect(selfService().enabled).toBe(false);
    await expect(selfService().deleteMyAccount({ confirmEmail: 'someone@example.com' })).resolves.toMatchObject({ ok: false, code: 'refused' });
    await expect(selfService().requestEmailChange({ newEmail: 'new@example.com' })).resolves.toMatchObject({ ok: false, code: 'refused' });
  });
});

describe('the help address in effect', () => {
  it('is the configured one when there’s no settings table to read (the CI outputs), never a blank', async () => {
    await expect(effectiveHelp()).resolves.toEqual({ address: helpAddressFor(site), source: 'config' });
  });
});
