import { describe, expect, it } from 'vitest';
import { amplifyBranchOrigin, expectedOrigin, publicOrigin } from '@/lib/origin';
import { devOrigin } from '@/site.config';

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

describe('the site origin comes from configuration, never from the request', () => {
  it('under next dev: the *.localhost origin from site.config.ts (Next rewrites request.url to localhost)', () => {
    expect(expectedOrigin(env({ NODE_ENV: 'development' }))).toBe(devOrigin);
    expect(publicOrigin(env({ NODE_ENV: 'development' }))).toBe(devOrigin);
  });

  it('the auth-matrix server overrides it with its own loopback origin, and only a loopback one', () => {
    expect(expectedOrigin(env({ NODE_ENV: 'development', SITE_DEV_ORIGIN: 'http://127.0.0.1:3210' }))).toBe('http://127.0.0.1:3210');
    expect(() => expectedOrigin(env({ NODE_ENV: 'development', SITE_DEV_ORIGIN: 'http://attacker.example' }))).toThrow(/loopback/);
  });

  it('in production: APP_ORIGIN when set (a custom domain), else the branch’s Amplify address', () => {
    expect(expectedOrigin(env({ NODE_ENV: 'production', APP_ORIGIN: 'https://www.example.com' }))).toBe('https://www.example.com');
    expect(expectedOrigin(env({ NODE_ENV: 'production', AWS_BRANCH: 'feature/new-thing', AWS_APP_ID: 'dexample0app' }))).toBe(
      'https://feature-new-thing.dexample0app.amplifyapp.com',
    );
  });

  it('refuses a malformed or plain-http APP_ORIGIN instead of comparing against it', () => {
    for (const bad of ['http://www.example.com', 'https://www.example.com/', 'https://www.example.com/path', 'www.example.com']) {
      expect(() => expectedOrigin(env({ NODE_ENV: 'production', APP_ORIGIN: bad }))).toThrow(/https origin/);
    }
  });

  it('with nothing configured in production: no expected origin (auth-kit then fails closed) and no invite links', () => {
    expect(expectedOrigin(env({ NODE_ENV: 'production' }))).toBeUndefined();
    expect(() => publicOrigin(env({ NODE_ENV: 'production' }))).toThrow(/APP_ORIGIN/);
  });

  it('builds Amplify branch addresses conservatively', () => {
    expect(amplifyBranchOrigin('main', 'dexample0app')).toBe('https://main.dexample0app.amplifyapp.com');
    expect(amplifyBranchOrigin(undefined, 'dexample0app')).toBeUndefined();
    expect(amplifyBranchOrigin('main', 'not an id')).toBeUndefined();
  });
});
