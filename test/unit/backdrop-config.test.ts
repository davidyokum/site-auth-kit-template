/**
 * Writing the backdrop into site.config.ts (scripts/lib/backdrop-config.mjs): the picker's "Use this
 * one" and `npm run backdrop:lock`. It's code going into a source file, so it's checked hard.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultBackdrop } from 'auth-kit/backdrops';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBackdropRoute } from '@/lib/dev/backdrop-route';
import { describeChange, formatBackdrop, lockChoiceFor, replaceBackdrop, validateChoice, writeBackdropChoice } from '@/scripts/lib/backdrop-config.mjs';
import { loadSiteConfig } from '@/scripts/lib/site-config.mjs';
import { site as configured } from '@/site.config';

const ROOT = join(import.meta.dirname, '..', '..');
/**
 * This site's own site.config.ts with its backdrop line as the template ships it (nothing chosen
 * yet), so these hold on the template and on every site made from it, chosen backdrop or not.
 */
const REAL = readFileSync(join(ROOT, 'site.config.ts'), 'utf8').replace(/^ {2}backdrop: .*$/m, '  backdrop: null as SiteBackdrop | null,');
const CHOICE = { style: 'contours', seed: 'k3f9x2ab', styleVersion: 1 };

describe('validateChoice and formatBackdrop', () => {
  it('writes a locked, literal object', () => {
    expect(formatBackdrop(CHOICE)).toBe("{ style: 'contours', seed: 'k3f9x2ab', styleVersion: 1, locked: true }");
    expect(validateChoice({ ...CHOICE, seed: 12345 })).toEqual({ ...CHOICE, seed: '12345' });
  });

  it('refuses anything that could break out of the string, and choices this auth-kit can’t draw', () => {
    for (const seed of ["x'; process.exit(1); '", 'a b', 'ü', '', 'x'.repeat(65), "x'", 'x\\n', 1.5]) {
      expect(() => validateChoice({ ...CHOICE, seed }), String(seed)).toThrow(/seed/);
    }
    expect(() => validateChoice({ ...CHOICE, style: "contours'" })).toThrow(/isn't a backdrop style/);
    expect(() => validateChoice({ ...CHOICE, style: 'painted' })).toThrow(/needs an image/);
    expect(() => validateChoice({ ...CHOICE, styleVersion: 99 })).toThrow(/has no version 99/);
    expect(() => validateChoice({ ...CHOICE, styleVersion: '1' })).toThrow(/has no version/);
    expect(() => validateChoice(null)).toThrow(/must be an object/);
  });
});

describe('replaceBackdrop', () => {
  it('rewrites the one backdrop line in the real site.config.ts, and nothing else', () => {
    const { source, previous, next } = replaceBackdrop(REAL, CHOICE);
    expect(previous).toBe('null');
    expect(next).toBe(formatBackdrop(CHOICE));
    expect(source).toContain("  backdrop: { style: 'contours', seed: 'k3f9x2ab', styleVersion: 1, locked: true } as SiteBackdrop | null,");
    expect(source.split('\n').length).toBe(REAL.split('\n').length);
    const changed = source.split('\n').filter((line, i) => line !== REAL.split('\n')[i]);
    expect(changed).toHaveLength(1);
  });

  it('replaces an existing choice, including one spread over several lines', () => {
    const once = replaceBackdrop(REAL, CHOICE).source;
    const twice = replaceBackdrop(once, { style: 'aurora', seed: 'zz', styleVersion: 1 });
    expect(twice.previous).toBe("{ style: 'contours', seed: 'k3f9x2ab', styleVersion: 1, locked: true }");
    expect(twice.source).toContain("backdrop: { style: 'aurora', seed: 'zz', styleVersion: 1, locked: true } as SiteBackdrop | null,");
    const multi = REAL.replace('backdrop: null as SiteBackdrop | null,', "backdrop: {\n    style: 'ripples',\n    seed: 'abc',\n  } as SiteBackdrop | null,");
    expect(replaceBackdrop(multi, CHOICE).source).toContain("backdrop: { style: 'contours'");
  });

  it('refuses a file without exactly one backdrop line in the expected form', () => {
    expect(() => replaceBackdrop(REAL.replace('backdrop: null as SiteBackdrop | null,', 'backdrop: pick(),'), CHOICE)).toThrow(/has no line like/);
    expect(() => replaceBackdrop(`${REAL}\n  backdrop: null as SiteBackdrop | null,\n`, CHOICE)).toThrow(/2 backdrop lines/);
  });
});

describe('writeBackdropChoice', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'backdrop-config-'));
    writeFileSync(join(dir, 'site.config.ts'), REAL);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('writes the choice, keeps the previous file as site.config.ts.bak, and reports the change', async () => {
    const result = await writeBackdropChoice(dir, CHOICE);
    expect(readFileSync(join(dir, 'site.config.ts.bak'), 'utf8')).toBe(REAL);
    expect(readFileSync(join(dir, 'site.config.ts'), 'utf8')).toContain(`backdrop: ${formatBackdrop(CHOICE)} as SiteBackdrop | null,`);
    expect(describeChange(result)).toBe(`site.config.ts: backdrop null → ${formatBackdrop(CHOICE)} (previous file: site.config.ts.bak)`);
  });

  it('changes nothing when the choice is refused', async () => {
    await expect(writeBackdropChoice(dir, { ...CHOICE, seed: "'; x" })).rejects.toThrow(/seed/);
    expect(readFileSync(join(dir, 'site.config.ts'), 'utf8')).toBe(REAL);
  });

  it('the written file still loads, with the locked backdrop', async () => {
    writeFileSync(join(dir, 'site.families.ts'), readFileSync(join(ROOT, 'site.families.ts'), 'utf8'));
    await writeBackdropChoice(dir, CHOICE);
    const { site } = await loadSiteConfig(dir);
    expect(site.backdrop).toEqual({ ...CHOICE, locked: true });
  });
});

describe('lockChoiceFor (npm run backdrop:lock)', () => {
  it('locks the name’s proposal, literally', () => {
    const proposal = defaultBackdrop('Example Site');
    expect(lockChoiceFor({ name: 'Example Site', backdrop: null })).toEqual(proposal);
  });

  it('keeps a style set by hand, filling the seed and version from the proposal', () => {
    expect(lockChoiceFor({ name: 'Example Site', backdrop: { style: 'ripples' } })).toEqual({ style: 'ripples', seed: defaultBackdrop('Example Site').seed, styleVersion: 1 });
  });

  it('does nothing to a backdrop that is already locked', () => {
    expect(lockChoiceFor({ name: 'Renamed Site', backdrop: { ...CHOICE, locked: true } })).toBeNull();
  });
});

describe('loadSiteConfig', () => {
  it('reads the real site.config.ts from a plain script', async () => {
    const { site } = await loadSiteConfig(ROOT);
    expect(site.name).toBe(configured.name);
    expect(site.backdrop).toEqual(configured.backdrop);
  });
});

describe('the picker’s write route (lib/dev/backdrop-route.ts)', () => {
  let dir = '';
  const lines: string[] = [];
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'backdrop-route-'));
    writeFileSync(join(dir, 'site.config.ts'), REAL);
    lines.length = 0;
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const route = (env: { NODE_ENV?: string } = { NODE_ENV: 'development' }) => createBackdropRoute({ root: dir, env, log: (line) => lines.push(line) });
  const request = (headers: Record<string, string> = {}, body: unknown = CHOICE) =>
    new Request('http://localhost:3000/api/dev/backdrop', {
      method: 'POST',
      headers: { host: 'app.localhost:3000', origin: 'http://app.localhost:3000', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  const unchanged = () => expect(readFileSync(join(dir, 'site.config.ts'), 'utf8')).toBe(REAL);

  it('writes a valid choice from the picker page, and prints the change', async () => {
    const response = await route().POST(request());
    expect(response.status).toBe(200);
    const body = (await response.json()) as { message: string; detail: string };
    expect(body.message).toMatch(/Saved and locked/);
    expect(body.detail).toContain(formatBackdrop(CHOICE));
    expect(lines.at(-1)).toMatch(/^backdrop picker: site\.config\.ts: backdrop null →/);
    expect(readFileSync(join(dir, 'site.config.ts'), 'utf8')).toContain(formatBackdrop(CHOICE));
  });

  it('answers 404 outside next dev, from another host or origin, through a proxy, or cross-site', async () => {
    const cases: [string, Response][] = [
      ['production', await route({ NODE_ENV: 'production' }).POST(request())],
      ['another host', await route().POST(request({ host: 'evil.example', origin: 'http://evil.example' }))],
      ['another origin', await route().POST(request({ origin: 'https://attacker.example' }))],
      ['no origin', await route().POST(request({ origin: '' }))],
      ['cross-site', await route().POST(request({ 'sec-fetch-site': 'cross-site' }))],
      ['forwarded', await route().POST(request({ 'x-forwarded-for': '203.0.113.9' }))],
    ];
    for (const [what, response] of cases) expect(response.status, what).toBe(404);
    expect(lines.every((line) => line.startsWith('backdrop picker: refused'))).toBe(true);
    unchanged();
  });

  it('refuses a body that isn’t JSON or isn’t a valid choice, changing nothing', async () => {
    expect((await route().POST(request({ 'content-type': 'text/plain' }))).status).toBe(415);
    expect((await route().POST(request({}, '{nope'))).status).toBe(400);
    const bad = await route().POST(request({}, { ...CHOICE, seed: "x' + process.exit() + '" }));
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toMatch(/seed/);
    unchanged();
  });
});

describe('the backdrop commands the README and the build’s lock message name', () => {
  it('are npm scripts', () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['backdrop:pick']).toBe('node scripts/backdrop-pick.mjs');
    expect(pkg.scripts['backdrop:lock']).toBe('node scripts/backdrop-lock.mjs');
  });
});
