/**
 * The site's backdrop (lib/backdrop.ts): what the sign-in pages draw, and the build's lock check.
 * auth-kit ADR 0020: the name only proposes; a locked backdrop never changes; deploy builds refuse
 * a backdrop that isn't locked.
 */
import { defaultBackdrop } from 'auth-kit/backdrops';
import { describe, expect, it, vi } from 'vitest';
import { backdropLockMessage, enforceBackdropLock, siteBackdrop } from '@/lib/backdrop';
import { site } from '@/site.config';

const LOCKED = { style: 'contours', seed: 'k3f9x2ab', styleVersion: 1, locked: true } as const;

describe('siteBackdrop', () => {
  it('draws the locked choice exactly, whatever the site is called', () => {
    expect(siteBackdrop({ name: 'Example Site', backdrop: LOCKED })).toEqual({ style: 'contours', seed: 'k3f9x2ab', styleVersion: 1, locked: true });
    expect(siteBackdrop({ name: 'A Completely Different Name', backdrop: LOCKED })).toEqual(siteBackdrop({ name: 'Example Site', backdrop: LOCKED }));
  });

  it('draws the name’s proposal until there’s a choice (and so would change with a rename)', () => {
    const proposal = defaultBackdrop('Example Site');
    expect(siteBackdrop({ name: 'Example Site', backdrop: null })).toEqual({ ...proposal, locked: false });
    expect(siteBackdrop({ name: 'Renamed', backdrop: null }).seed).not.toBe(proposal.seed);
  });

  it('keeps a style set by hand while it isn’t locked', () => {
    const drawn = siteBackdrop({ name: 'Example Site', backdrop: { style: 'ripples' } });
    expect(drawn).toMatchObject({ style: 'ripples', seed: defaultBackdrop('Example Site').seed, locked: false });
  });
});

describe('enforceBackdropLock (next.config.ts)', () => {
  const unlocked = { name: 'Example Site', backdrop: null };

  it('fails a deploy build (Amplify sets AWS_BRANCH) or a build told to require it, naming the fix', () => {
    expect(() => enforceBackdropLock(unlocked, { phase: 'phase-production-build', env: { AWS_BRANCH: 'main' } })).toThrow(/npm run backdrop:pick/);
    expect(() => enforceBackdropLock(unlocked, { phase: 'phase-production-build', env: { SITE_BACKDROP_LOCK: 'require' } })).toThrow(/isn't locked/);
  });

  it('warns loudly in any other production build (CI, a local build), and notes it under next dev', () => {
    const warn = vi.fn();
    enforceBackdropLock(unlocked, { phase: 'phase-production-build', env: {}, warn });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toMatch(/!{20}[\s\S]*isn't locked[\s\S]*Deploy builds \(Amplify\) fail/);
    warn.mockClear();
    enforceBackdropLock(unlocked, { phase: 'phase-development-server', env: {}, warn });
    expect(warn.mock.calls[0]![0]).toMatch(/npm run backdrop:pick/);
    warn.mockClear();
    enforceBackdropLock(unlocked, { phase: 'phase-production-server', env: { AWS_BRANCH: 'main' }, warn });
    expect(warn).not.toHaveBeenCalled();
  });

  it('passes a locked backdrop silently, deploy builds included', () => {
    const warn = vi.fn();
    expect(() => enforceBackdropLock({ name: 'Example Site', backdrop: LOCKED }, { phase: 'phase-production-build', env: { AWS_BRANCH: 'main' }, warn })).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
    expect(backdropLockMessage({ name: 'Example Site', backdrop: LOCKED })).toBeNull();
  });

  it('refuses a half-locked backdrop too (no seed, no version, or locked missing)', () => {
    for (const backdrop of [{ style: 'contours', styleVersion: 1, locked: true }, { style: 'contours', seed: 'x', locked: true }, { style: 'contours', seed: 'x', styleVersion: 1 }] as const) {
      expect(() => enforceBackdropLock({ name: 'Example Site', backdrop }, { phase: 'phase-production-build', env: { AWS_BRANCH: 'main' } })).toThrow(/isn't locked/);
    }
  });
});

describe('this site', () => {
  it('stores either nothing (the template: production deploys fail until chosen) or a complete lock', () => {
    if (site.backdrop === null) expect(backdropLockMessage(site)).toMatch(/npm run backdrop:pick/);
    else expect(backdropLockMessage(site)).toBeNull();
  });
});
