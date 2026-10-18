/**
 * The sign-in card on the site's backdrop: /sign-in, the error page, and not found.
 *
 * The backdrop is site.config.ts's locked choice (or, until there is one, the proposal from the
 * site's name; lib/backdrop.ts). It's decorative: hidden from assistive technology, never in the way
 * of a click, a single still frame under reduced motion, and muted around the card by a scrim.
 */
import { Backdrop } from 'auth-kit/backdrops/react';
import type { ReactNode } from 'react';
import { siteBackdrop } from '@/lib/backdrop';
import { site } from '@/site.config';
import { AuthCard } from './auth-card';

export function AuthScene({ children }: { children: ReactNode }) {
  const backdrop = siteBackdrop(site);
  return (
    <Backdrop
      style={backdrop.style}
      seed={backdrop.seed}
      styleVersion={backdrop.styleVersion}
      family={site.family}
      className="auth-scene"
      contentClassName="auth-scene-content"
    >
      <AuthCard>{children}</AuthCard>
    </Backdrop>
  );
}
