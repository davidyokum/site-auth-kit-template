'use client';
/**
 * Errors, including "couldn't check" (auth-kit's 503 when Cognito or its keys can't be reached).
 * That is never treated as signed out or allowed: the page stays closed and says so.
 *
 * Production builds hide server error details from the browser (only `digest` survives), so this
 * page can name the sign-in service only under `next dev`; the wording is honest either way.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const unavailable = error.name === 'AuthUnavailableError';
  return (
    <div className="stack">
      <h1>{unavailable ? 'Can’t check your sign-in right now' : 'This page couldn’t load'}</h1>
      <p>
        {unavailable
          ? 'The sign-in service didn’t answer, so this page stayed closed. Nothing was shown or changed.'
          : 'Something failed on the server. If it was the sign-in check, the page stayed closed; nothing was shown or changed.'}
      </p>
      {error.digest && <p className="muted small">Reference: {error.digest}</p>}
      <p>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </p>
    </div>
  );
}
