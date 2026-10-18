/**
 * DEV ONLY: the backdrop picker (`npm run backdrop:pick`): nine variations behind the site's real
 * sign-in card; "Use this one" writes the choice into site.config.ts, locked. The `.dev.tsx`
 * extension makes this a page only under `next dev` (withDevKit in next.config.ts); a build has no
 * such page, and `npm run check:prod-build` fails if the picker's code is in one.
 */
import type { Metadata } from 'next';
import { SiteBackdropPicker } from '@/lib/dev/backdrop-picker';

export const metadata: Metadata = { title: 'Backdrop picker' };

export default function BackdropPickerPage() {
  return <SiteBackdropPicker />;
}
