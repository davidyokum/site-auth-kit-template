/**
 * The site's backdrop (auth-kit/backdrops; ADR 0021): what the sign-in card sits on, and the build's
 * check that the site's owner chose it.
 *
 * site.config.ts stores the literal choice, `{ style, seed, styleVersion, locked: true, chosen:
 * 'owner' }`. Until a site has one, the site's name proposes a backdrop, drawn locally so there's
 * something to see; a deploy build refuses to ship a proposal (it changes if the site is renamed),
 * and refuses a locked backdrop the owner didn't choose (auth-kit ADR 0028: the look is theirs).
 * The owner chooses with `npm run backdrop:pick`, or names one for `npm run backdrop:set`.
 *
 * Plain module with no path aliases: next.config.ts imports it.
 */
import { backdropLockProblems, type BackdropStyleId, defaultBackdrop, isBackdropStyleId, latestStyleVersion } from 'auth-kit/backdrops';
import type { SiteBackdrop } from '../site.config';

export interface ResolvedBackdrop {
  style: BackdropStyleId;
  seed: string;
  styleVersion: number;
  /** True when site.config.ts holds a complete, locked choice; false for the name's proposal. */
  locked: boolean;
}

interface BackdropSite {
  readonly name: string;
  readonly backdrop: SiteBackdrop | null;
}

/** What the sign-in pages draw: the locked choice, or (not locked) the name's proposal, keeping any style set by hand. */
export function siteBackdrop(site: BackdropSite): ResolvedBackdrop {
  const stored = site.backdrop;
  if (stored && backdropLockProblems(stored).length === 0) {
    return { style: stored.style, seed: String(stored.seed), styleVersion: stored.styleVersion as number, locked: true };
  }
  const proposal = defaultBackdrop(site.name);
  const style = stored && isBackdropStyleId(stored.style) ? stored.style : proposal.style;
  const version = stored?.styleVersion;
  return {
    style,
    seed: stored?.seed !== undefined && String(stored.seed).trim() !== '' ? String(stored.seed) : proposal.seed,
    styleVersion: Number.isInteger(version) && (version as number) >= 1 && (version as number) <= latestStyleVersion(style) ? (version as number) : latestStyleVersion(style),
    locked: false,
  };
}

/** True when site.config.ts records that the site's owner chose the backdrop (`chosen: 'owner'`). */
export function ownerChoseBackdrop(site: BackdropSite): boolean {
  return site.backdrop?.chosen === 'owner';
}

/** Why the backdrop isn't ready to deploy, for people: null when it is (locked, and the owner's choice). */
export function backdropLockMessage(site: BackdropSite): string | null {
  const problems = backdropLockProblems(site.backdrop);
  const choose = "The site's owner chooses it: npm run backdrop:pick with them (or npm run backdrop:set -- <style>:<seed>:<version> --owner-chose once they've named one), then commit site.config.ts.";
  if (problems.length === 0) {
    if (ownerChoseBackdrop(site)) return null;
    return [`site.config.ts: the backdrop is locked, but nothing records that the site's owner chose it (no chosen: 'owner').`, choose].join('\n');
  }
  const drawn = siteBackdrop(site);
  return [
    `site.config.ts: the backdrop isn't chosen yet (${problems.join('; ')}).`,
    `Until it is, the sign-in pages draw a proposal from the site's name (${drawn.style} v${drawn.styleVersion}, seed ${drawn.seed}), which would change if the site were renamed.`,
    choose,
  ].join('\n');
}

export interface LockCheckInput {
  /** Next's phase for this config load. */
  phase: string;
  env: Readonly<Record<string, string | undefined>>;
  warn?: (message: string) => void;
}

/**
 * Run from next.config.ts. A production build fails on a backdrop that isn't locked, or that the
 * owner didn't choose, when it's a deploy (Amplify sets AWS_BRANCH) or when SITE_BACKDROP_LOCK=require;
 * any other production build (CI, a local `next build`) warns loudly. `next dev` notes it once and
 * carries on.
 */
export function enforceBackdropLock(site: BackdropSite, input: LockCheckInput): void {
  const message = backdropLockMessage(site);
  if (!message) return;
  const warn = input.warn ?? ((text: string) => console.warn(text));
  if (input.phase === 'phase-production-build') {
    if (input.env.AWS_BRANCH || input.env.SITE_BACKDROP_LOCK === 'require') {
      throw new Error(`${message}\nThis is a deploy build, so it stops here.`);
    }
    const rule = '!'.repeat(72);
    warn(`\n${rule}\n${message}\nDeploy builds (Amplify) fail until the owner has chosen.\n${rule}\n`);
  } else if (input.phase === 'phase-development-server') {
    warn(
      siteBackdrop(site).locked
        ? "Backdrop: nothing records that the site's owner chose it; deploy builds will stop. npm run backdrop:pick with them."
        : `Backdrop not chosen yet: drawing ${siteBackdrop(site).style} proposed from the site's name. The site's owner chooses with npm run backdrop:pick.`,
    );
  }
}
