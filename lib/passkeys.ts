/**
 * The pool's passkey settings, as the sign-in screens need them (auth-kit `SignIn`'s `passkey`
 * prop). An address without a passkey gets a passkey window that finds nothing (auth-kit ADR 0018);
 * with the pool's relying-party ID, that window asks the browser exactly what Cognito's would, so it
 * looks the same for every address. Null until passkeys are on (site.config.ts `passkeys`).
 *
 * Under `next dev` the app talks to your sandbox pool, whose relying party is `localhost` (auth-kit's
 * preset gives sandboxes `sandboxRelyingPartyId`, default `localhost`, which covers `app.localhost`).
 */
import { site } from '@/site.config';

export function passkeyPrompt(env: { NODE_ENV?: string } = process.env): { relyingPartyId: string } | null {
  if (site.passkeys === false) return null;
  return { relyingPartyId: env.NODE_ENV === 'development' ? 'localhost' : site.passkeys.relyingPartyId };
}
