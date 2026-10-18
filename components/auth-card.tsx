/**
 * The sign-in card (the design report's §7.1 core): the same everywhere but for the family's owner
 * line, identity line, and colors (the primary button, the 4px rule, links, the border's tint), which
 * come from auth-kit/backdrops' family table so the card and its backdrop agree. The card carries its
 * own contrast: opaque, a crisp 1px border, a soft shadow; nothing fades the backdrop around it. All
 * text sits inside the card; nothing is ever written on the backdrop (auth-kit ADR 0021).
 *
 * `data-backdrop-card` tells the backdrop where the card is, so its scrim keeps the art quiet here.
 * A plain component (no hooks, no server-only imports): pages, error boundaries, and the backdrop
 * picker's previews all use it.
 */
import { BACKDROP_FAMILIES } from 'auth-kit/backdrops';
import type { CSSProperties, ReactNode } from 'react';
import { site } from '@/site.config';
import { cardFooter, ownerLine, type SiteFamily } from '@/site.families';

export function AuthCard({ children, family = site.family }: { children: ReactNode; family?: SiteFamily }) {
  const theme = BACKDROP_FAMILIES[family].card;
  const identity = { ...site, family };
  const colors = {
    '--card-rule': theme.rule,
    '--card-border': theme.border,
    '--card-button': theme.button,
    '--card-button-text': theme.buttonText,
    '--card-link': theme.link,
    '--card-heading': theme.heading,
    '--card-body': theme.body,
    '--card-focus': theme.focus,
  } as CSSProperties;
  return (
    <section className="auth-card" data-backdrop-card="" data-family={family} style={colors}>
      <p className="auth-card-owner">{ownerLine(identity)}</p>
      {children}
      <p className="auth-card-footer">{cardFooter(identity)}</p>
    </section>
  );
}
