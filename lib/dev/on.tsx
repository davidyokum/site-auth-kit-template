/**
 * DEV ONLY: what `@/dev` means under `next dev` (withDevKit in next.config.ts). Same exports as
 * off.tsx, plus the dev pieces: the sandbox check behind the ribbon, the signed-in persona, and the
 * "Sign in as…" menu. Nothing in a build imports this file.
 */
import { PersonaMenu } from 'auth-kit/dev/menu';
import { EnvironmentRibbon, type EnvironmentRibbonInput } from 'auth-kit/ribbon';
import { cookies } from 'next/headers';
import { matrixOverrides } from '@/dev-matrix';
import { outputs } from '@/lib/outputs';
import { devKit } from './kit';

/** The ribbon's input: environment, pool, whether it's a confirmed sandbox, and the persona. */
export async function ribbonInput(): Promise<EnvironmentRibbonInput> {
  if (matrixOverrides()) {
    // The auth-matrix server has no AWS access; don't ask Cognito whether the pool is a sandbox.
    return { environment: 'local', poolId: outputs.auth.user_pool_id, poolIsSandbox: null, poolCheckError: 'auth-matrix test server' };
  }
  return devKit.ribbon(await cookies());
}

export async function DevRibbon() {
  return (
    <EnvironmentRibbon {...await ribbonInput()}>
      <PersonaMenu />
    </EnvironmentRibbon>
  );
}
