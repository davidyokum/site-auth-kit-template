// Writing the site's backdrop into site.config.ts (auth-kit ADR 0020): the backdrop picker's "Use
// this one" (app/api/dev/backdrop/route.dev.ts) and `npm run backdrop:lock` both come here.
//
// site.config.ts is code, so what goes in is checked first: a style auth-kit has, a version of it
// this auth-kit has, and a seed of letters, digits, `-` and `_` only (nothing that could close the
// string). The `backdrop:` line is rewritten in place, only if there's exactly one; the previous file
// is kept in site.config.ts.bak; and the result is read back and checked before it counts as saved.
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { backdropLockProblems, backdropStyle, defaultBackdrop, isBackdropStyleId, latestStyleVersion } from 'auth-kit/backdrops';

export const CONFIG_FILE = 'site.config.ts';
export const BACKUP_FILE = 'site.config.ts.bak';

/** The `backdrop:` property: `null` or a flat object literal, typed `as SiteBackdrop | null`. */
const BACKDROP_PROPERTY = /^([ \t]*)backdrop:[ \t]*(null|\{[^{}]*\})[ \t]+as[ \t]+SiteBackdrop[ \t]*\|[ \t]*null,[ \t]*$/gm;

const SEED_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Checks a choice and returns it normalized: `{ style, seed, styleVersion }`.
 * @param {unknown} value
 * @returns {{ style: string, seed: string, styleVersion: number }}
 */
export function validateChoice(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('A backdrop choice must be an object: { style, seed, styleVersion }.');
  const { style, seed, styleVersion } = /** @type {Record<string, unknown>} */ (value);
  if (!isBackdropStyleId(style)) throw new Error(`"${String(style)}" isn't a backdrop style.`);
  const styleModule = backdropStyle(style);
  if (!styleModule?.generative) throw new Error(`"${style}" needs an image, so the picker can't choose it; set it by hand.`);
  const text = typeof seed === 'number' && Number.isSafeInteger(seed) ? String(seed) : seed;
  if (typeof text !== 'string' || !SEED_RE.test(text)) throw new Error('The seed must be 1-64 letters, digits, "-" or "_".');
  if (!Number.isInteger(styleVersion) || styleVersion < 1 || styleVersion > styleModule.versions.length) {
    throw new Error(`"${style}" has no version ${String(styleVersion)} in this auth-kit (it has 1-${styleModule.versions.length}).`);
  }
  return { style, seed: text, styleVersion: /** @type {number} */ (styleVersion) };
}

/**
 * The literal that goes in site.config.ts.
 * @param {{ style: string, seed: string, styleVersion: number }} choice
 */
export function formatBackdrop(choice) {
  const { style, seed, styleVersion } = validateChoice(choice);
  return `{ style: '${style}', seed: '${seed}', styleVersion: ${styleVersion}, locked: true }`;
}

/**
 * Rewrites the `backdrop:` line. Throws unless there's exactly one, in the expected form.
 * @param {string} source
 * @param {{ style: string, seed: string, styleVersion: number }} choice
 * @returns {{ source: string, previous: string, next: string }}
 */
export function replaceBackdrop(source, choice) {
  const matches = [...source.matchAll(BACKDROP_PROPERTY)];
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? `${CONFIG_FILE} has no line like "backdrop: null as SiteBackdrop | null," (the picker rewrites exactly that line; put it back in that form).`
        : `${CONFIG_FILE} has ${matches.length} backdrop lines; keep exactly one.`,
    );
  }
  const match = /** @type {RegExpMatchArray} */ (matches[0]);
  const next = formatBackdrop(choice);
  const line = `${match[1]}backdrop: ${next} as SiteBackdrop | null,`;
  const index = /** @type {number} */ (match.index);
  return { source: source.slice(0, index) + line + source.slice(index + match[0].length), previous: /** @type {string} */ (match[2]).replace(/\s+/g, ' '), next };
}

/**
 * What `npm run backdrop:lock` writes: the backdrop the site draws now, made literal. A style set
 * by hand is kept; a missing seed or version comes from the name's proposal. Null if already locked.
 * @param {{ name: string, backdrop: unknown }} site
 * @returns {{ style: string, seed: string, styleVersion: number } | null}
 */
export function lockChoiceFor(site) {
  if (backdropLockProblems(site.backdrop).length === 0) return null;
  const proposal = defaultBackdrop(site.name);
  const stored = /** @type {Record<string, unknown> | null} */ (typeof site.backdrop === 'object' ? site.backdrop : null);
  const style = stored && isBackdropStyleId(stored.style) && backdropStyle(stored.style)?.generative ? stored.style : proposal.style;
  const seed = stored && (typeof stored.seed === 'string' || typeof stored.seed === 'number') && SEED_RE.test(String(stored.seed)) ? String(stored.seed) : proposal.seed;
  const version = stored && Number.isInteger(stored.styleVersion) ? /** @type {number} */ (stored.styleVersion) : latestStyleVersion(style);
  return validateChoice({ style, seed, styleVersion: version });
}

/**
 * Writes a choice into `<root>/site.config.ts`, keeping the previous file as site.config.ts.bak.
 * @param {string} root
 * @param {unknown} choice
 * @returns {Promise<{ previous: string, next: string, backup: string, file: string }>}
 */
export async function writeBackdropChoice(root, choice) {
  const normalized = validateChoice(choice);
  const file = join(root, CONFIG_FILE);
  const backup = join(root, BACKUP_FILE);
  const before = await readFile(file, 'utf8');
  const { source, previous, next } = replaceBackdrop(before, normalized);
  await writeFile(backup, before);
  // Write beside, then rename: an interrupted write never leaves half a config.
  const temp = `${file}.writing`;
  await writeFile(temp, source);
  await rename(temp, file);
  const after = await readFile(file, 'utf8');
  if (!after.includes(`backdrop: ${next} as SiteBackdrop | null,`)) throw new Error(`${CONFIG_FILE} didn't read back as written; the previous version is in ${BACKUP_FILE}.`);
  return { previous, next, backup: BACKUP_FILE, file: CONFIG_FILE };
}

/**
 * One line for a terminal or the picker: what changed.
 * @param {{ previous: string, next: string, backup: string }} result
 */
export function describeChange(result) {
  return `${CONFIG_FILE}: backdrop ${result.previous} → ${result.next} (previous file: ${result.backup})`;
}
