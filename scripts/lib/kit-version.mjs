// Which auth-kit release this site is on, and whether it's the newest (CI's "auth-kit is current"
// job). Pure: the caller fetches the release list.

/**
 * The version in package.json's auth-kit tarball URL.
 * @param {string} spec  e.g. https://github.com/davidyokum/auth-kit/releases/download/v0.1.16-alpha.1/auth-kit-0.1.16-alpha.1.tgz
 * @returns {string | null}
 */
export function kitVersionOf(spec) {
  return /\/auth-kit-([0-9][^/]*)\.tgz$/.exec(String(spec ?? ''))?.[1] ?? null;
}

/**
 * The newest published release in GitHub's list (`GET /repos/davidyokum/auth-kit/releases`, newest
 * first): pre-releases count, since auth-kit ships as alphas; drafts don't.
 * @param {readonly { tag_name?: string, draft?: boolean }[]} releases
 * @returns {string | null}
 */
export function newestRelease(releases) {
  const release = releases.find((r) => r && r.draft !== true && typeof r.tag_name === 'string' && /^v\d/.test(r.tag_name));
  return release ? /** @type {string} */ (release.tag_name).slice(1) : null;
}
