/**
 * lib/account-modes.ts decides which pages, routes, tables, and jobs each account-creation mode gets.
 * Its rules must be auth-kit's own, mode by mode, or the site would offer a route auth-kit refuses
 * (or miss one it serves).
 */
import { allowsSelfSignUp, normalizeAccountCreation, takesAccessRequests } from 'auth-kit/accounts';
import { describe, expect, it } from 'vitest';
import { type AccountCreationLike, accountCreationPageExtensions, hasAccountCreationRoutes, takesRequests, takesSignUps } from '@/lib/account-modes';
import { site } from '@/site.config';

const SETTINGS: AccountCreationLike[] = [
  { mode: 'invite' },
  { mode: 'request' },
  { mode: 'domains', domains: ['example.org'] },
  { mode: 'domains', domains: ['example.org'], requestsAlso: true },
  { mode: 'open' },
];

describe('the account-creation modes (lib/account-modes.ts)', () => {
  it('match auth-kit’s rules for every mode', () => {
    for (const setting of SETTINGS) {
      const normalized = normalizeAccountCreation(setting);
      expect(takesSignUps(setting), JSON.stringify(setting)).toBe(allowsSelfSignUp(normalized));
      expect(takesRequests(setting), JSON.stringify(setting)).toBe(takesAccessRequests(normalized));
      expect(hasAccountCreationRoutes(setting)).toBe(allowsSelfSignUp(normalized) || takesAccessRequests(normalized));
    }
  });

  it('switch on exactly the pages and routes each mode has', () => {
    expect(accountCreationPageExtensions({ mode: 'invite' })).toEqual([]);
    expect(accountCreationPageExtensions({ mode: 'request' })).toEqual(['request.tsx', 'request.ts']);
    expect(accountCreationPageExtensions({ mode: 'domains', domains: ['example.org'] })).toEqual(['signup.tsx', 'signup.ts']);
    expect(accountCreationPageExtensions({ mode: 'domains', domains: ['example.org'], requestsAlso: true })).toEqual(['signup.tsx', 'signup.ts', 'request.tsx', 'request.ts']);
    expect(accountCreationPageExtensions({ mode: 'open' })).toEqual(['signup.tsx', 'signup.ts']);
  });

  it('this site’s setting is one auth-kit accepts (invite only in the template)', () => {
    expect(() => normalizeAccountCreation(site.accountCreation)).not.toThrow();
  });
});
