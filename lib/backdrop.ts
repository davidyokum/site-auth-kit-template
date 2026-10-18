/**
 * The site's backdrop (auth-kit/backdrops; ADR 0020): what the sign-in card sits on, and the build's
 * check that it's locked.
 *
 * site.config.ts stores the literal choice, `{ style, seed, styleVersion, locked: true }`. Until a
 * site has one, the site's name proposes a backdrop, drawn locally so there's something to see; a
 * production build refuses to ship a proposal, because a proposal changes if the site is renamed or
 * auth-kit offers different styles. Choose with `npm run backdrop:pick`, or keep the proposal with
 * `npm run backdrop:lock`.
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

/** Why the backdrop isn't locked, for people: null when it is. */
export function backdropLockMessage(site: BackdropSite): string | null {
  const problems = backdropLockProblems(site.backdrop);
  if (problems.length === 0) return null;
  const drawn = siteBackdrop(site);
  return [
    `site.config.ts: the backdrop isn't locked (${problems.join('; ')}).`,
    `Until it is, the sign-in pages draw a proposal from the site's name (${drawn.style} v${drawn.styleVersion}, seed ${drawn.seed}), which would change if the site were renamed.`,
    'Choose one: npm run backdrop:pick   (or keep this one: npm run backdrop:lock), then commit site.config.ts.',
  ].join('\n');
}

export interface LockCheckInput {
  /** Next's phase for this config load. */
  phase: string;
  env: Readonly<Record<string, string | undefined>>;
  warn?: (message: string) => void;
}

/**
 * Run from next.config.ts. A production build fails on an unlocked backdrop when it's a deploy
 * (Amplify sets AWS_BRANCH) or when SITE_BACKDROP_LOCK=require; any other production build (CI, a
 * local `next build`) warns loudly. `next dev` notes it once and carries on.
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
    warn(`\n${rule}\n${message}\nDeploy builds (Amplify) fail until it's locked.\n${rule}\n`);
  } else if (input.phase === 'phase-development-server') {
    warn(`Backdrop not locked yet: drawing ${siteBackdrop(site).style} proposed from the site's name. npm run backdrop:pick to choose.`);
  }
}
