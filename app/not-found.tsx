import Link from 'next/link';
import { AuthScene } from '@/components/auth-scene';

/**
 * Shown for missing pages, records someone may not see, and pages they're not allowed to open. All
 * three read the same on purpose: the answer doesn't confirm that a record or page exists. Shown on
 * the sign-in card and the site's backdrop (components/auth-scene.tsx).
 */
export default function NotFound() {
  return (
    <AuthScene>
      <div className="stack auth-message">
        <h1>Not found</h1>
        <p>There&apos;s nothing here, or it isn&apos;t yours to see.</p>
        <p>
          <Link href="/">Go to the home page</Link>
        </p>
      </div>
    </AuthScene>
  );
}
