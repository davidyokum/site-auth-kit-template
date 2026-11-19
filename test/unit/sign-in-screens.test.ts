/**
 * Sign-in screens have no site chrome, and the authenticator setup page always has a way out
 * (auth-kit 0.1.20; a real first sign-in got stuck between the header's links and the setup page).
 * The matrix checks the pages render on the backdrop; this checks the stylesheet and the panel.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AuthenticatorSetupPanel } from '@/app/account/authenticator/setup-panel';

const root = join(import.meta.dirname, '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('sign-in screens', () => {
  it('the stylesheet hides the site header on every AuthScene page', () => {
    expect(read('app/globals.css')).toMatch(/body:has\(\.auth-scene\)\s*>\s*\.site-header\s*\{\s*display:\s*none;\s*\}/);
  });

  it('every page that renders a sign-in card renders it inside AuthScene', () => {
    for (const page of ['app/sign-in/page.tsx', 'app/signed-out/page.tsx', 'app/account/sign-in-method/page.tsx', 'app/account/authenticator/page.tsx']) {
      expect(read(page), page).toContain('<AuthScene>');
    }
  });

  it('the authenticator setup page is auth-kit’s card, with "Sign out everywhere" as its way out', () => {
    const html = renderToStaticMarkup(createElement(AuthenticatorSetupPanel, { issuer: 'Example Reports', accountName: 'ada@example.org' }));
    expect(html).toContain('data-auth-kit="authenticator-setup"');
    expect(html).toContain('data-backdrop-card');
    expect(html).toContain('Example Reports also needs a code from an authenticator app');
    const source = read('app/account/authenticator/setup-panel.tsx');
    expect(source).toMatch(/onCancel=\{/);
    expect(source).toContain('cancelLabel={MY_ACCOUNT.signOut}');
  });
});
