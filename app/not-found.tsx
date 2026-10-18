import { AuthCard } from 'auth-kit/client';
import Link from 'next/link';
import { AuthScene } from '@/components/auth-scene';
import { siteTheme } from '@/lib/theme';
import { site } from '@/site.config';

/**
 * Shown for missing pages, items someone may not see, and pages they're not allowed to open. All
 * three read the same on purpose: the answer doesn't confirm that an item or page exists. Shown on
 * auth-kit's card on the site's backdrop (components/auth-scene.tsx).
 */
export default function NotFound() {
  return (
    <AuthScene>
      <AuthCard name="site-message" theme={siteTheme(site)} classNames={undefined}>
        <div data-auth-kit-slot="form">
          <h1 data-auth-kit-slot="heading">Not found</h1>
          <p data-auth-kit-slot="text">There&apos;s nothing here, or it isn&apos;t yours to see.</p>
          <p data-auth-kit-slot="text">
            <Link href="/" data-auth-kit-slot="link">
              Go to the home page
            </Link>
          </p>
        </div>
      </AuthCard>
    </AuthScene>
  );
}
