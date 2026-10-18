'use client';
/**
 * Errors, including "couldn't check" (auth-kit's 503 when Cognito or its keys can't be reached).
 * That is never treated as signed out or allowed: the page stays closed and says so.
 *
 * Production builds hide server error details from the browser (the name and message are gone;
 * only `digest` survives). auth-kit's `AuthUnavailableError` carries its own digest, which Next
 * keeps, so `isAuthUnavailableError` recognizes it in development and production alike. The
 * reference matches the server's log line for that error.
 *
 * It's shown on auth-kit's card (`AuthCard`: the family's colors, edge, and footer) on the site's
 * backdrop (components/auth-scene.tsx).
 */
import { AuthCard, isAuthUnavailableError } from 'auth-kit/client';
import { AuthScene } from '@/components/auth-scene';
import { siteTheme } from '@/lib/theme';
import { site } from '@/site.config';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const unavailable = isAuthUnavailableError(error);
  return (
    <AuthScene>
      <AuthCard name="site-message" theme={siteTheme(site)} classNames={undefined}>
        <div data-auth-kit-slot="form">
          <h1 data-auth-kit-slot="heading">{unavailable ? 'Can’t check your sign-in right now' : 'This page couldn’t load'}</h1>
          <p data-auth-kit-slot="text">
            {unavailable
              ? 'The sign-in service didn’t answer, so this page stayed closed. Nothing was shown or changed.'
              : 'Something failed on the server. Try again, and if it keeps happening, quote the reference below.'}
          </p>
          {error.digest && <p data-auth-kit-slot="small">Reference: {error.digest}</p>}
          <button type="button" data-auth-kit-slot="button" onClick={reset}>
            Try again
          </button>
        </div>
      </AuthCard>
    </AuthScene>
  );
}
