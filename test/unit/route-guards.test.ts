/**
 * 03 §2 Enforcement: "every route handler, server action, and data-loading server component calls
 * requireUser() or a role check." The auth matrix proves the answers; this static check catches a
 * new page, route, or action without a server-side check before it ever runs, and keeps the
 * dev-only code where it belongs.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DEV_ALIAS, DEV_MATRIX_ALIAS } from 'auth-kit/dev';
import { describe, expect, it } from 'vitest';
import { PUBLIC_PAGES, PUBLIC_ROUTES } from '@/lib/public-routes';

const ROOT = join(import.meta.dirname, '..', '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [relative(ROOT, path)];
  });
}

const appFiles = walk(join(ROOT, 'app'));
const source = (file: string) => readFileSync(join(ROOT, file), 'utf8');

/** What a module loads when it runs: `import … from`, `export … from`, `import '…'`. `import type` is erased, so it's skipped. */
const runtimeImports = (file: string) =>
  [...source(file).matchAll(/^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gm)].map((m) => m[1]);

/** The names a module exports: declarations and `export { a as b }` lists (re-exports included). */
const exportedNames = (file: string) => {
  const text = source(file);
  const declared = [...text.matchAll(/export (?:async )?(?:function|const|let|class) (\w+)/g)].map((m) => m[1] ?? '');
  const listed = [...text.matchAll(/export\s*\{([^}]*)\}/g)].flatMap((m) =>
    (m[1] ?? '').split(',').map((part) => part.trim().split(/\s+as\s+/).pop() ?? '').filter(Boolean),
  );
  return [...declared, ...listed].sort();
};

/** A server-side check from lib/auth.ts, or auth-kit's People actions (which check live themselves). */
const GUARD = /\b(?:pages|auth)\.require(?:User|Can|Group)\(|\bpeopleActions\(\)\.forms\.\w+\(/;

/** The URL path a page file serves, e.g. app/app/tickets/[id]/page.tsx → /app/tickets/[id]. */
const urlOf = (file: string) => `/${file.replace(/^app\//, '').replace(/\/?page\.tsx$/, '')}`.replace(/\/$/, '') || '/';

describe('every page, layout, route, and action checks on the server', () => {
  const pages = appFiles.filter((f) => /\/page\.tsx$/.test(f));
  const layouts = appFiles.filter((f) => /\/layout\.tsx$/.test(f) && f !== 'app/layout.tsx');
  const routes = appFiles.filter((f) => /\/route\.ts$/.test(f));
  const actions = appFiles.filter((f) => source(f).trimStart().startsWith("'use server'"));

  it('finds the files it checks', () => {
    expect(pages.length).toBeGreaterThanOrEqual(9);
    expect(routes.length).toBeGreaterThanOrEqual(2);
    expect(actions.length).toBeGreaterThanOrEqual(2);
  });

  it('pages call a guard, except the listed public ones', () => {
    for (const page of pages) {
      if ((PUBLIC_PAGES as readonly string[]).includes(urlOf(page))) continue;
      expect(source(page), `${page} has no requireUser/requireCan/requireGroup`).toMatch(GUARD);
    }
  });

  it('public pages are exactly the ones the proxy lets through (plus /sign-in, always public)', () => {
    for (const page of PUBLIC_PAGES) {
      expect(page === '/sign-in' || (PUBLIC_ROUTES as readonly string[]).includes(page), `${page} isn't in PUBLIC_ROUTES`).toBe(true);
    }
  });

  it('nested layouts call a guard (and their pages still do too)', () => {
    for (const layout of layouts) expect(source(layout), `${layout} has no guard`).toMatch(GUARD);
  });

  it('every exported handler in every route file calls a guard', () => {
    for (const route of routes) {
      const handlers = source(route).split(/export const (?=GET|POST|PUT|PATCH|DELETE)/).slice(1);
      expect(handlers.length, `${route} exports no handlers`).toBeGreaterThan(0);
      for (const handler of handlers) expect(handler, `${route}: ${handler.slice(0, 6)} has no guard`).toMatch(GUARD);
    }
  });

  it('every exported server action calls a guard', () => {
    for (const file of actions) {
      const functions = source(file).split(/export async function /).slice(1);
      expect(functions.length, `${file} exports no actions`).toBeGreaterThan(0);
      for (const fn of functions) expect(fn, `${file}: ${fn.split('(')[0]} has no guard`).toMatch(GUARD);
    }
  });

  it('routes that change data check the origin against the configured one (lib/origin.ts)', () => {
    for (const route of routes) {
      for (const handler of source(route).split(/export const (?=POST|PUT|PATCH|DELETE)/).slice(1)) {
        expect(handler, `${route} changes data without assertSameOrigin(request, { expectedOrigin: expectedOrigin() })`).toMatch(
          /assertSameOrigin\(\s*request\s*,\s*\{\s*expectedOrigin:\s*expectedOrigin\(\)\s*\}\s*\)/,
        );
      }
    }
  });

  it('record pages and routes check the record and answer 404 (requireRecordAccess)', () => {
    for (const file of appFiles.filter((f) => /\[id\]\/(page\.tsx|route\.ts)$/.test(f))) {
      expect(source(file), `${file} takes an ID but doesn't call requireRecordAccess`).toMatch(/requireRecordAccess\(/);
    }
  });

  it('the public list has no wildcards', () => {
    for (const route of PUBLIC_ROUTES) expect(route).not.toMatch(/\*/);
  });
});

describe('dev-only code stays out of what ships', () => {
  const shipped = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'components')), ...walk(join(ROOT, 'lib')), 'proxy.ts']
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => !/\.dev\.tsx?$/.test(f) && !f.startsWith('lib/dev/'));

  it('only dev-only files import auth-kit/dev, auth-kit/dev/menu, auth-kit/testing, or lib/dev/*', () => {
    for (const file of shipped) {
      const imports = [...source(file).matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const spec of imports) {
        expect(spec, `${file} imports ${spec}`).not.toMatch(/^auth-kit\/(dev|testing)(\/|$)|^@\/lib\/dev\//);
      }
    }
  });

  it('the dev sign-in route is a .dev.ts file (a route only under next dev)', () => {
    expect(appFiles).toContain('app/api/dev/sign-in/route.dev.ts');
    expect(appFiles.filter((f) => f.startsWith('app/api/dev/') && !/\.dev\.tsx?$/.test(f))).toEqual([]);
  });

  it('the "off" modules (what every build gets) load no dev code (a type import is erased)', () => {
    for (const file of ['lib/dev/off.tsx', 'lib/dev/matrix.off.ts']) {
      for (const spec of runtimeImports(file)) expect(spec, `${file} imports ${spec}`).not.toMatch(/auth-kit\/(dev|testing)|\.\/kit$|matrix\.on|\.\/on$/);
    }
  });

  it('the on and off modules export the same names', () => {
    expect(exportedNames('lib/dev/on.tsx')).toEqual(exportedNames('lib/dev/off.tsx'));
    expect(exportedNames('lib/dev/matrix.on.ts')).toEqual(['matrixOverrides']);
    expect(exportedNames('lib/dev/matrix.off.ts')).toEqual(['matrixOverrides']);
  });

  it('next.config.ts uses auth-kit’s aliases, which name this repo’s on/off files; type checks see the off ones', () => {
    expect(source('next.config.ts')).toMatch(/withDevKit\(phase, config, \{ aliases: \[DEV_ALIAS, DEV_MATRIX_ALIAS\] \}\)/);
    const tsconfig = JSON.parse(source('tsconfig.json').replace(/^\s*\/\/.*$/gm, '')) as { compilerOptions: { paths: Record<string, string[]> } };
    for (const { alias, on, off } of [DEV_ALIAS, DEV_MATRIX_ALIAS]) {
      expect(existsSync(join(ROOT, on)), `${alias} → ${on}`).toBe(true);
      expect(existsSync(join(ROOT, off)), `${alias} → ${off}`).toBe(true);
      expect(tsconfig.compilerOptions.paths[alias]).toEqual([off]);
    }
  });
});
