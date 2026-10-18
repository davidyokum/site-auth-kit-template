/** lib/passkeys.ts: the pool's relying party for the sign-in card's passkey window (your sandbox's under next dev). */
import { describe, expect, it, vi } from 'vitest';

describe('the passkey prompt settings (lib/passkeys.ts)', () => {
  it('are null until passkeys are on (the template ships them off)', async () => {
    vi.resetModules();
    vi.doMock('@/site.config', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/site.config')>();
      return { ...actual, site: { ...actual.site, passkeys: false } };
    });
    const { passkeyPrompt } = await import('@/lib/passkeys');
    expect(passkeyPrompt({ NODE_ENV: 'production' })).toBeNull();
    vi.doUnmock('@/site.config');
  });

  it('name the final domain in a build, and localhost (the sandbox’s relying party) under next dev', async () => {
    vi.resetModules();
    vi.doMock('@/site.config', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/site.config')>();
      return { ...actual, site: { ...actual.site, passkeys: { relyingPartyId: 'www.example.org' } } };
    });
    const { passkeyPrompt } = await import('@/lib/passkeys');
    expect(passkeyPrompt({ NODE_ENV: 'production' })).toEqual({ relyingPartyId: 'www.example.org' });
    expect(passkeyPrompt({ NODE_ENV: 'development' })).toEqual({ relyingPartyId: 'localhost' });
    vi.doUnmock('@/site.config');
  });
});
