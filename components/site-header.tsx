/**
 * The header: who's signed in and what they can open. Display only: every page and route checks for
 * itself; hiding a link protects nothing.
 */
import { AuthUnavailableError } from 'auth-kit/server';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { site } from '@/site.config';
import { SignOutButton } from './sign-out-button';

async function currentUser() {
  try {
    return { user: await auth.getUser(), unavailable: false };
  } catch (error) {
    if (error instanceof AuthUnavailableError) return { user: null, unavailable: true };
    throw error;
  }
}

export async function SiteHeader() {
  const { user, unavailable } = await currentUser();
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-name">
          {site.name}
        </Link>
        <nav className="site-nav" aria-label="Main">
          {user ? (
            <>
              <Link href="/app/projects">Projects</Link>
              {auth.can(user, 'people.read') && <Link href="/admin">Admin</Link>}
              <Link href="/account">My account</Link>
              <span className="muted small">{user.profile?.email ?? 'Signed in'}</span>
              <SignOutButton />
            </>
          ) : (
            <>
              {/* "Couldn't check" is not "signed out": say so instead of guessing. */}
              {unavailable && <span className="muted small">Couldn&apos;t check your sign-in right now.</span>}
              <Link href="/sign-in" className="button button-primary">
                Sign in
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
