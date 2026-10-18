/**
 * The public landing page (listed in lib/public-routes.ts). It loads no private data, so it calls
 * no guard; the header shows who's signed in for display only.
 */
import Link from 'next/link';
import { site } from '@/site.config';

export default function Home() {
  return (
    <div className="stack">
      <h1>{site.name}</h1>
      <p>
        A starter site on AWS Amplify Gen 2 with sign-in from <code>auth-kit</code>: passkeys first, then a password with an
        authenticator code, then an emailed code as the backstop. Accounts are by invitation only.
      </p>
      <p>
        <Link href="/sign-in" className="button button-primary">
          Sign in
        </Link>
      </p>
      <div className="grid-2">
        <section className="card">
          <h2>Tickets</h2>
          <p className="muted">
            Members file tickets and see only their own. Staff see every ticket. Anyone else asking for a ticket by its
            address gets &ldquo;not found&rdquo;.
          </p>
        </section>
        <section className="card">
          <h2>Admin</h2>
          <p className="muted">
            One owner, Super admins, and admins (content &amp; people, content only, or view only) run the site.
            Every change is written to an append-only activity log.
          </p>
        </section>
      </div>
    </div>
  );
}
