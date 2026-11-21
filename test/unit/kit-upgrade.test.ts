/**
 * The "auth-kit upgrade" workflow's rules (scripts/lib/kit-upgrade.mjs, .github/workflows/kit-upgrade.yml,
 * renovate/auth-kit.json; auth-kit ADR 0030): Renovate's kit PRs change only the kit's lines, and merge on
 * their own only as a patch with no site steps.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  autoMergeDecision,
  changedFileProblems,
  kitUrl,
  kitVersionOfUrl,
  lockfileProblems,
  lockPinsRelease,
  packageJsonProblems,
  releaseMeta,
  updateType,
} from '@/scripts/lib/kit-upgrade.mjs';

const root = join(import.meta.dirname, '..', '..');

describe('kit-upgrade', () => {
  it('reads only auth-kit release tarball URLs', () => {
    expect(kitVersionOfUrl(kitUrl('0.1.21-alpha.1'))).toBe('0.1.21-alpha.1');
    expect(kitVersionOfUrl('https://github.com/someone-else/auth-kit/releases/download/v0.1.21/auth-kit-0.1.21.tgz')).toBeNull();
    expect(kitVersionOfUrl('https://github.com/davidyokum/auth-kit/releases/download/v0.1.21/auth-kit-0.1.22.tgz')).toBeNull();
    expect(kitVersionOfUrl('^0.1.21')).toBeNull();
  });

  it('names the move as Renovate does, pre-releases included', () => {
    expect(updateType('0.1.20-alpha.1', '0.1.21-alpha.1')).toBe('patch');
    expect(updateType('0.1.20-alpha.1', '0.1.20-alpha.2')).toBe('patch');
    expect(updateType('0.1.20-alpha.1', '0.1.20')).toBe('patch');
    expect(updateType('0.1.20-alpha.1', '0.2.0-alpha.1')).toBe('minor');
    expect(updateType('0.1.20-alpha.1', '1.0.0')).toBe('major');
    expect(updateType('0.1.20-alpha.2', '0.1.20-alpha.1')).toBeNull();
    expect(updateType('0.1.20', '0.1.20-alpha.9')).toBeNull();
    expect(updateType('0.1.20-alpha.1', '0.1.20-alpha.1')).toBeNull();
  });

  it('reads the release notes’ first line', () => {
    expect(releaseMeta('Upgrade: patch. Site steps: none. Security: none.\n\nFixes a thing.')).toEqual({ upgrade: 'patch', siteSteps: 'none', security: null });
    expect(releaseMeta('Upgrade: minor. Site steps: see Migration. Security: GHSA-abcd-1234-wxyz.')).toEqual({ upgrade: 'minor', siteSteps: 'migration', security: 'GHSA-abcd-1234-wxyz' });
    expect(releaseMeta('Simple sign-in: a site can choose …')).toBeNull();
  });

  it('lets only a patch with no site steps merge on its own', () => {
    const patch = releaseMeta('Upgrade: patch. Site steps: none. Security: none.');
    expect(autoMergeDecision({ update: 'patch', meta: patch }).state).toBe('success');
    expect(autoMergeDecision({ update: 'minor', meta: patch }).state).toBe('pending');
    expect(autoMergeDecision({ update: 'patch', meta: null }).state).toBe('pending');
    expect(autoMergeDecision({ update: 'patch', meta: releaseMeta('Upgrade: patch. Site steps: see Migration. Security: none.') }).state).toBe('pending');
    expect(autoMergeDecision({ update: 'patch', meta: releaseMeta('Upgrade: minor. Site steps: none. Security: none.') }).state).toBe('pending');
    const security = autoMergeDecision({ update: 'patch', meta: releaseMeta('Upgrade: patch. Site steps: none. Security: GHSA-abcd-1234-wxyz.') });
    expect(security.state).toBe('success');
    expect(security.description).toContain('GHSA-abcd-1234-wxyz');
    for (const d of [security, autoMergeDecision({ update: 'major', meta: null })]) expect(d.description.length).toBeLessThan(140);
  });

  const basePkg = { name: 'site', dependencies: { 'auth-kit': kitUrl('0.1.20-alpha.1'), next: '16.4.6' }, devDependencies: { vitest: '4.0.0' } };
  const headPkg = { ...basePkg, dependencies: { ...basePkg.dependencies, 'auth-kit': kitUrl('0.1.21-alpha.1') } };
  const lock = (version: string, extra: Record<string, unknown> = {}) => ({
    name: 'site',
    lockfileVersion: 3,
    packages: {
      '': { name: 'site', dependencies: { 'auth-kit': kitUrl(version), next: '16.4.6' } },
      'node_modules/auth-kit': { version, resolved: kitUrl(version), integrity: `sha512-${version}` },
      'node_modules/next': { version: '16.4.6', resolved: 'https://registry.npmjs.org/next/-/next-16.4.6.tgz', integrity: 'sha512-n' },
      ...extra,
    },
  });

  it('refuses a PR that changes package.json beyond auth-kit', () => {
    expect(packageJsonProblems(basePkg, headPkg)).toEqual([]);
    expect(packageJsonProblems(basePkg, { ...headPkg, dependencies: { ...headPkg.dependencies, next: '16.5.0' } })).toEqual(['package.json dependencies changed besides auth-kit']);
    expect(packageJsonProblems(basePkg, { ...headPkg, scripts: { postinstall: 'curl …' } })).toEqual(['package.json "scripts" changed']);
  });

  it('allows only the kit’s lockfile lines to change', () => {
    expect(lockfileProblems(lock('0.1.20-alpha.1'), lock('0.1.21-alpha.1'))).toEqual([]);
    expect(lockfileProblems(lock('0.1.20-alpha.1'), lock('0.1.21-alpha.1', { 'node_modules/left-pad': { version: '1.3.0' } }))).toEqual(['package-lock.json "node_modules/left-pad" added']);
    const moved = lock('0.1.21-alpha.1');
    moved.packages['node_modules/next'] = { ...moved.packages['node_modules/next'], version: '16.5.0' };
    expect(lockfileProblems(lock('0.1.20-alpha.1'), moved)).toEqual(['package-lock.json "node_modules/next" changed']);
    expect(lockfileProblems(lock('0.1.20-alpha.1'), { ...lock('0.1.21-alpha.1'), lockfileVersion: 2 })).toEqual(['package-lock.json "lockfileVersion" changed']);
  });

  it('knows when the lockfile is finished, and that it pins the attested tarball', () => {
    expect(lockPinsRelease(lock('0.1.20-alpha.1'), 'dependencies', '0.1.21-alpha.1')).toBe(false);
    expect(lockPinsRelease(lock('0.1.21-alpha.1'), 'dependencies', '0.1.21-alpha.1')).toBe(true);
    expect(lockPinsRelease(lock('0.1.21-alpha.1'), 'dependencies', '0.1.21-alpha.1', 'sha512-0.1.21-alpha.1')).toBe(true);
    expect(lockPinsRelease(lock('0.1.21-alpha.1'), 'dependencies', '0.1.21-alpha.1', 'sha512-other')).toBe(false);
  });

  it('allows only package.json and package-lock.json, in the site’s folder', () => {
    expect(changedFileProblems(['package.json', 'package-lock.json'], '.')).toEqual([]);
    expect(changedFileProblems(['web/package.json', 'web/package-lock.json'], 'web')).toEqual([]);
    expect(changedFileProblems(['package.json', '.github/workflows/ci.yml'], '.')).toHaveLength(1);
  });

  it('matches this site’s package.json with the Renovate preset, and scopes Renovate to auth-kit', () => {
    const preset = JSON.parse(readFileSync(join(root, 'renovate', 'auth-kit.json'), 'utf8')) as {
      enabledManagers: string[];
      customManagers: { matchStrings: string[]; autoReplaceStringTemplate: string }[];
      gitIgnoredAuthors: string[];
    };
    expect(preset.enabledManagers).toEqual(['custom.regex']);
    const manager = preset.customManagers[0]!;
    const pkgText = readFileSync(join(root, 'package.json'), 'utf8');
    const match = new RegExp(manager.matchStrings[0]!).exec(pkgText);
    expect(match?.groups?.currentValue).toBe(kitVersionOfUrl((JSON.parse(pkgText) as typeof basePkg).dependencies['auth-kit']));
    expect(manager.autoReplaceStringTemplate.replaceAll('{{{newValue}}}', '0.1.21-alpha.1')).toBe(`"auth-kit": "${kitUrl('0.1.21-alpha.1')}"`);
    // The workflow commits as github-actions[bot]; Renovate keeps rebasing (and may merge) only if it ignores that author.
    const workflow = readFileSync(join(root, '.github', 'workflows', 'kit-upgrade.yml'), 'utf8');
    expect(workflow).toContain(`git config user.email '${preset.gitIgnoredAuthors[0]}'`);
    expect(JSON.parse(readFileSync(join(root, 'renovate.json'), 'utf8'))).toEqual({
      $schema: 'https://docs.renovatebot.com/renovate-schema.json',
      extends: ['github>davidyokum/site-auth-kit-template//renovate/auth-kit'],
    });
  });

  it('starts CI on the finished commit, so CI must take workflow_dispatch', () => {
    expect(readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8')).toMatch(/^ {2}workflow_dispatch:/m);
  });
});
