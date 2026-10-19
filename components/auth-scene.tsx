/**
 * The site's backdrop behind a sign-in card: /sign-in, /sign-up, /request-access, the chooser page,
 * /signed-out, the error page, and not found. The card itself is auth-kit's (`SignIn`, `SignUp`,
 * `AuthCard`, …): it carries the family's colors, the computed 3:1 edge, and the footer identity line,
 * with nothing above the heading (auth-kit ADR 0024). This component only puts the art behind it.
 *
 * The backdrop is site.config.ts's locked choice (or, until there is one, the proposal from the
 * site's name; lib/backdrop.ts). It's decorative: hidden from assistive technology, never in the way
 * of a click, a single still frame under reduced motion or on a slow device (auth-kit 0.1.9; register
 * E6), and nothing fades it around the card (only the Plain card style's soft column, register E4). The
 * site's name reaches the styles that draw it (Yokum magnetic's falling title).
 */
import { Backdrop } from 'auth-kit/backdrops/react';
import type { ReactNode } from 'react';
import { siteBackdrop } from '@/lib/backdrop';
import { site } from '@/site.config';

export function AuthScene({ children }: { children: ReactNode }) {
  const backdrop = siteBackdrop(site);
  return (
    <Backdrop
      style={backdrop.style}
      seed={backdrop.seed}
      styleVersion={backdrop.styleVersion}
      family={site.family}
      siteName={site.name}
      className="auth-scene"
      contentClassName="auth-scene-content"
    >
      {children}
    </Backdrop>
  );
}
