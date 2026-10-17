import { environmentMetadata, environmentRibbonModel } from 'auth-kit/ribbon';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { DevRibbon, ribbonInput } from '@/dev';
import { SiteHeader } from '@/components/site-header';
import { site } from '@/site.config';
import { AmplifyClient } from './amplify-client';
import './globals.css';

/** `[DEV]` / `[PREVIEW]` in the tab title and a matching favicon everywhere but the live site. */
export async function generateMetadata(): Promise<Metadata> {
  const model = environmentRibbonModel(await ribbonInput());
  return {
    ...environmentMetadata(model, { template: `%s · ${site.name}`, default: site.name }),
    // A starter site shouldn't be indexed by accident; remove this when the public pages are ready.
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Every page renders per request: the CSP nonce (proxy.ts) needs it, and private pages must never
  // be cached or built statically (03 §2 Enforcement).
  await connection();
  return (
    <html lang="en">
      <body>
        {/* LOCAL / PREVIEW ribbon naming the pool and who's signed in; nothing on the live site. */}
        <DevRibbon />
        <AmplifyClient />
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
