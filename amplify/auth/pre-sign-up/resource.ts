/**
 * The preSignUp trigger, on `domains` sites (auth-kit ADR 0023; the preset requires it there). It
 * re-checks the domain list on every account the sign-up route makes (they carry the immutable
 * `custom:authkit_origin` mark), lets admin invites through, and refuses Cognito's own SignUp (which
 * the preset keeps off anyway). amplify/auth/resource.ts wires it only in `domains` mode.
 */
import { defineFunction } from '@aws-amplify/backend';

export const preSignUp = defineFunction({
  name: 'pre-sign-up',
  entry: './handler.ts',
  runtime: 22,
  resourceGroupName: 'auth',
});
