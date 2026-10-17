'use client';
/**
 * Sign-out is a global sign-out, labeled as signing out everywhere (03 §2 Sessions): it revokes the
 * refresh tokens on every device, not just this browser's cookies.
 */
import { signOutEverywhere } from 'auth-kit/client';
import { useState } from 'react';

export function SignOutButton() {
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');
  return (
    <>
      <button
        type="button"
        className="button-link"
        disabled={state === 'busy'}
        onClick={async () => {
          setState('busy');
          try {
            await signOutEverywhere();
            // A full page load, not a client navigation, so no server-rendered page from the old session survives.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign('/');
          } catch {
            setState('failed');
          }
        }}
      >
        Sign out everywhere
      </button>
      {state === 'failed' && (
        <span role="alert" className="error small">
          Couldn&apos;t sign out. Check your connection and try again.
        </span>
      )}
    </>
  );
}
