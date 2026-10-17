/**
 * app/error.tsx tells auth-kit's "couldn't check" apart from other failures, including in production
 * builds, where Next hands the boundary only the error's digest (no name, no message).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ErrorPage from '@/app/error';

const render = (error: Partial<Error> & { digest?: string }) =>
  renderToStaticMarkup(createElement(ErrorPage, { error: error as Error & { digest?: string }, reset: () => {} }));

describe('the error page (app/error.tsx)', () => {
  it('says "couldn’t check" for auth-kit’s digest alone, as a production build delivers it', () => {
    const html = render({ digest: 'AUTH_KIT_AUTH_UNAVAILABLE;0123456789abcdef' });
    expect(html).toContain('Can’t check your sign-in right now');
    expect(html).toContain('Reference: AUTH_KIT_AUTH_UNAVAILABLE;0123456789abcdef');
  });

  it('says so under next dev too, where the error keeps its name', () => {
    expect(render({ name: 'AuthUnavailableError', message: 'Sign-in status is temporarily unavailable.' })).toContain('Can’t check your sign-in right now');
  });

  it('doesn’t claim a sign-in problem for any other failure', () => {
    const html = render({ name: 'Error', digest: '1234567890' });
    expect(html).toContain('This page couldn’t load');
    expect(html).not.toContain('sign-in');
  });
});
