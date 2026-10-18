'use client';
/**
 * DEV ONLY: the backdrop picker's client half (auth-kit/backdrops/picker), behind the site's real
 * sign-in card. Imported only by app/dev/backdrops/page.dev.tsx, a route only under `next dev`; the
 * picker carries auth-kit's marker, so `npm run check:prod-build` fails a build that contains it.
 *
 * It reads site.config.ts directly, so after "Use this one" writes the file, Next's dev server
 * reloads it and the page shows the new, locked backdrop.
 */
import { BackdropPicker } from 'auth-kit/backdrops/picker';
import { SignIn } from 'auth-kit/client';
import { AuthCard } from '@/components/auth-card';
import { siteBackdrop } from '@/lib/backdrop';
import { site } from '@/site.config';
import { emailHintFor, type SiteFamily } from '@/site.families';

function renderCard(family: SiteFamily) {
  return (
    <AuthCard family={family}>
      <SignIn siteName={site.name} passkeysEnabled={site.passkeys !== false} emailHint={emailHintFor({ ...site, family })} navigate={() => undefined} />
    </AuthCard>
  );
}

async function use(choice: { style: string; seed: string; styleVersion: number }) {
  const response = await fetch('/api/dev/backdrop', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(choice) });
  const body = (await response.json().catch(() => null)) as { message?: string; detail?: string; error?: string } | null;
  if (!response.ok || !body?.message) throw new Error(body?.error ?? `The dev server didn't save it (HTTP ${response.status}); its terminal says why.`);
  return { message: body.message, ...(body.detail !== undefined && { detail: body.detail }) };
}

export function SiteBackdropPicker() {
  const drawn = siteBackdrop(site);
  return (
    <BackdropPicker
      siteName={site.name}
      family={site.family}
      current={site.backdrop}
      proposed={drawn.locked ? null : { style: drawn.style, seed: drawn.seed, styleVersion: drawn.styleVersion }}
      renderCard={renderCard}
      onUse={use}
      unlockedHelp={
        <>
          This site’s backdrop isn’t locked: it’s proposed from the site’s name, so a rename would change it, and deploy builds fail until it’s locked.
          Choose one below, or keep the proposal with <code>npm run backdrop:lock</code>.
        </>
      }
    />
  );
}
