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
 * It's shown on the sign-in card and the site's backdrop (components/auth-scene.tsx).
 */
import { isAuthUnavailableError } from 'auth-kit/client';
import { AuthScene } from '@/components/auth-scene';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const unavailable = isAuthUnavailableError(error);
  return (
    <AuthScene>
      <div className="stack auth-message">
        <h1>{unavailable ? 'Can’t check your sign-in right now' : 'This page couldn’t load'}</h1>
        <p>
          {unavailable
            ? 'The sign-in service didn’t answer, so this page stayed closed. Nothing was shown or changed.'
            : 'Something failed on the server. Try again, and if it keeps happening, quote the reference below.'}
        </p>
        {error.digest && <p className="muted small">Reference: {error.digest}</p>}
        <p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </p>
      </div>
    </AuthScene>
  );
}
