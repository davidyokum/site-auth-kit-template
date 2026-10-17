/**
 * What `@/dev` means in every build (and in type checks): the same exports as on.tsx, with no dev
 * code. auth-kit/ribbon is safe in production: previews (any branch but main) show a PREVIEW ribbon
 * naming the pool and who's signed in; the live site shows nothing.
 */
import { EnvironmentRibbon, type EnvironmentRibbonInput, resolveEnvironment } from 'auth-kit/ribbon';
import { auth } from '@/lib/auth';
import { outputs } from '@/lib/outputs';

export async function ribbonInput(): Promise<EnvironmentRibbonInput> {
  const environment = resolveEnvironment();
  let signedInAs: string | null = null;
  if (environment === 'preview') {
    // Display only: who's signed in, if anyone. A check that can't run just leaves it blank.
    const user = await auth.getUser().catch(() => null);
    signedInAs = user?.profile?.email ?? (user ? user.username : null);
  }
  return {
    environment,
    poolId: outputs.auth.user_pool_id,
    poolIsSandbox: null,
    signedInAs,
    branch: process.env.AWS_BRANCH ?? null,
  };
}

export async function DevRibbon() {
  return <EnvironmentRibbon {...await ribbonInput()} />;
}
