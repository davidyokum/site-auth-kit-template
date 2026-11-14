/** CI's "auth-kit is current" check (scripts/check-kit-current.mjs, scripts/lib/kit-version.mjs). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { kitVersionOf, newestRelease } from '@/scripts/lib/kit-version.mjs';

describe('kit-version', () => {
  it('reads the version out of the tarball URL, this site’s included', () => {
    expect(kitVersionOf('https://github.com/davidyokum/auth-kit/releases/download/v0.1.16-alpha.1/auth-kit-0.1.16-alpha.1.tgz')).toBe('0.1.16-alpha.1');
    expect(kitVersionOf('^1.0.0')).toBeNull();
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
    expect(kitVersionOf(pkg.dependencies['auth-kit']!)).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('takes the newest published release, pre-releases included, drafts not', () => {
    expect(newestRelease([{ tag_name: 'v0.1.17-alpha.1', draft: true }, { tag_name: 'v0.1.16-alpha.1' }, { tag_name: 'v0.1.15-alpha.1' }])).toBe('0.1.16-alpha.1');
    expect(newestRelease([])).toBeNull();
  });
});
