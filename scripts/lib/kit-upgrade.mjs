// The "auth-kit upgrade" workflow's rules (.github/workflows/kit-upgrade.yml, auth-kit ADR 0030).
// Renovate opens a PR that changes only package.json's auth-kit tarball URL; the workflow writes the
// lockfile lines with the release's own `auth-kit upgrade`, then holds the PR to three things before
// Renovate may merge it on its own: only auth-kit's lines changed, the lockfile pins the attested
// tarball, and the release's notes say it's a patch with no site steps. Pure: the CLI
// (scripts/kit-upgrade-ci.mjs) reads the files and the release.

export const KIT_RELEASES = 'https://github.com/davidyokum/auth-kit/releases/download';

/** The tarball URL a site pins for an auth-kit release. */
export function kitUrl(version) {
  return `${KIT_RELEASES}/v${version}/auth-kit-${version}.tgz`;
}

/** The version in an auth-kit release tarball URL, or null. */
export function kitVersionOfUrl(spec) {
  const match = /^https:\/\/github\.com\/davidyokum\/auth-kit\/releases\/download\/v([0-9][^/]*)\/auth-kit-([0-9][^/]*)\.tgz$/.exec(String(spec ?? ''));
  return match && match[1] === match[2] ? match[1] : null;
}

function parts(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(version));
  if (!match) return null;
  return { nums: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] ?? null };
}

/** semver order of two prerelease strings (null, a release, sorts after any prerelease). */
function comparePre(a, b) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const as = a.split('.');
  const bs = b.split('.');
  for (let i = 0; i < Math.max(as.length, bs.length); i++) {
    const x = as[i];
    const y = bs[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn && Number(x) !== Number(y)) return Number(x) - Number(y);
    if (xn !== yn) return xn ? -1 : 1;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * The kind of move from one release to another, as Renovate names it: 'patch' (same major and minor,
 * including a new pre-release of the same version), 'minor', or 'major'. Null when `to` isn't newer.
 */
export function updateType(from, to) {
  const a = parts(from);
  const b = parts(to);
  if (!a || !b) return null;
  for (let i = 0; i < 3; i++) {
    if (a.nums[i] !== b.nums[i]) {
      if (b.nums[i] < a.nums[i]) return null;
      return i === 0 ? 'major' : i === 1 ? 'minor' : 'patch';
    }
  }
  return comparePre(a.pre, b.pre) < 0 ? 'patch' : null;
}

/**
 * The line every auth-kit CHANGELOG section (and so every release's notes) opens with, from
 * 0.1.21 on:  `Upgrade: patch. Site steps: none. Security: none.`
 *   Upgrade      patch | minor | major (auth-kit's AGENTS.md says which a change is)
 *   Site steps   none | see Migration (a patch never has any)
 *   Security     none, or what it fixes (an advisory ID or a few words)
 * Returns null when the notes have no such line (every release before the convention).
 */
export function releaseMeta(notes) {
  const match = /^Upgrade: (patch|minor|major)\. Site steps: (none|see Migration)\. Security: (.+?)\.?\s*$/m.exec(String(notes ?? ''));
  if (!match) return null;
  return { upgrade: match[1], siteSteps: match[2] === 'none' ? 'none' : 'migration', security: match[3].trim().toLowerCase() === 'none' ? null : match[3].trim() };
}

/**
 * Whether Renovate may merge the PR by itself: the `auth-kit/auto-merge` status. 'success' only for a
 * patch whose notes say so and list no site steps; otherwise 'pending' with the reason, which keeps the
 * PR open for the owner (Renovate merges only when every status and check is green).
 */
export function autoMergeDecision({ update, meta }) {
  if (update !== 'patch') return { state: 'pending', description: `Waiting for the owner: a ${update ?? 'non-patch'} release. Read its notes, do any site steps, then merge.` };
  if (!meta) return { state: 'pending', description: 'Waiting for the owner: the release notes have no "Upgrade: … Site steps: …" line.' };
  if (meta.upgrade !== 'patch') return { state: 'pending', description: `Waiting for the owner: the notes call it a ${meta.upgrade} release.` };
  if (meta.siteSteps !== 'none') return { state: 'pending', description: 'Waiting for the owner: the release has site steps (its Migration section).' };
  return { state: 'success', description: meta.security ? `Patch, no site steps, security fix (${meta.security}): merges once checks pass.` : 'Patch, no site steps: merges once checks pass.' };
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function withoutKit(deps) {
  if (!deps) return deps;
  return Object.fromEntries(Object.entries(deps).filter(([name]) => name !== 'auth-kit'));
}

/**
 * What the PR changed in package.json besides auth-kit's own value: [] when nothing. Renovate's change
 * is one value; anything else means the PR isn't the kit-only upgrade this workflow finishes.
 */
export function packageJsonProblems(basePkg, headPkg) {
  const problems = [];
  const keys = new Set([...Object.keys(basePkg ?? {}), ...Object.keys(headPkg ?? {})]);
  for (const key of keys) {
    if (key === 'dependencies' || key === 'devDependencies') {
      if (!sameJson(withoutKit(basePkg[key]), withoutKit(headPkg[key]))) problems.push(`package.json ${key} changed besides auth-kit`);
    } else if (!sameJson(basePkg[key], headPkg[key])) {
      problems.push(`package.json "${key}" changed`);
    }
  }
  return problems;
}

/** The kit's entry and the root's line for it are the only lockfile lines an upgrade may change. */
export function lockfileProblems(baseLock, headLock) {
  const problems = [];
  for (const key of new Set([...Object.keys(baseLock ?? {}), ...Object.keys(headLock ?? {})])) {
    if (key !== 'packages' && !sameJson(baseLock[key], headLock[key])) problems.push(`package-lock.json "${key}" changed`);
  }
  const basePackages = baseLock?.packages ?? {};
  const headPackages = headLock?.packages ?? {};
  for (const path of new Set([...Object.keys(basePackages), ...Object.keys(headPackages)])) {
    if (path === 'node_modules/auth-kit') continue;
    const base = basePackages[path];
    const head = headPackages[path];
    if (path === '') {
      const strip = (entry) => entry && { ...entry, dependencies: withoutKit(entry.dependencies), devDependencies: withoutKit(entry.devDependencies) };
      if (!sameJson(strip(base), strip(head))) problems.push('package-lock.json\'s root entry changed besides auth-kit');
    } else if (!sameJson(base, head)) {
      problems.push(`package-lock.json "${path}" ${base === undefined ? 'added' : head === undefined ? 'removed' : 'changed'}`);
    }
    if (problems.length > 20) {
      problems.push('…and more');
      break;
    }
  }
  return problems;
}

/**
 * Whether the lockfile is finished for `version`: the kit's entry and the root's line pin that
 * release's URL, and (when given) its integrity is the attested tarball's sha512.
 */
export function lockPinsRelease(lock, field, version, integrity) {
  const url = kitUrl(version);
  const kit = lock?.packages?.['node_modules/auth-kit'];
  const root = lock?.packages?.['']?.[field]?.['auth-kit'];
  if (!kit || kit.version !== version || kit.resolved !== url || root !== url) return false;
  return integrity === undefined || kit.integrity === integrity;
}

/** Files a kit upgrade PR may change: the site's package.json and package-lock.json. */
export function changedFileProblems(files, dir) {
  const prefix = dir === '.' || dir === '' ? '' : `${dir.replace(/\/+$/, '')}/`;
  const allowed = new Set([`${prefix}package.json`, `${prefix}package-lock.json`]);
  return files.filter((f) => f && !allowed.has(f)).map((f) => `${f} changed (a kit upgrade PR changes only ${[...allowed].join(' and ')})`);
}
