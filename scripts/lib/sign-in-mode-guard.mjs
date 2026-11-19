// The build's check that a Full site isn't turned Simple (auth-kit ADR 0029). Pure: the decision from
// site.config.ts's signIn and the deployed backend's amplify_outputs.json, so the unit tests cover it.
//
// Simple to Full is a settings change and a deploy. Full to Simple isn't offered: an account with an
// authenticator app can't receive emailed codes, so on a pool that takes only emailed codes it would be
// locked out, and passkeys and passwords would stop working. The preset can't see the deployed pool,
// so the build looks before it deploys: a kit pool with MFA off (mfa_configuration NONE) is Simple;
// OPTIONAL or REQUIRED is Full.

/**
 * @param {{ mode?: unknown } | undefined} signIn  site.config.ts `signIn`
 * @param {{ outputs?: { auth?: { mfa_configuration?: unknown } } | null, noBackendYet?: boolean, error?: string | null }} deployed
 * @returns {{ ok: boolean, message: string }}
 */
export function signInModeGuard(signIn, deployed) {
  const simple = signIn?.mode === 'simple';
  if (!simple) return { ok: true, message: 'Full sign-in: nothing to check (Simple to Full is allowed).' };
  if (deployed.noBackendYet) return { ok: true, message: 'Simple sign-in on a new backend: the pool starts Simple.' };
  if (deployed.error) {
    return {
      ok: false,
      message: `This site is set to "Simple: code only", and the build couldn't read the deployed backend to check it was Simple before (${deployed.error}). Nothing was deployed. Fix the access, or set signIn back to { mode: 'full' } in site.config.ts.`,
    };
  }
  const mfa = deployed.outputs?.auth?.mfa_configuration;
  if (mfa === 'NONE') return { ok: true, message: 'Simple sign-in, and the deployed pool is Simple.' };
  if (mfa === 'OPTIONAL' || mfa === 'REQUIRED') {
    return {
      ok: false,
      message:
        'This site is set to "Simple: code only", but its deployed pool is Full. A Full site can\'t become Simple: anyone with an authenticator app would be locked out (Cognito sends them no emailed codes), and passkeys and passwords would stop working. Nothing was deployed. Set signIn back to { mode: \'full\' } in site.config.ts (auth-kit ADR 0029, "Moving between modes").',
    };
  }
  return { ok: false, message: `This site is set to "Simple: code only", and the deployed backend's sign-in mode couldn't be told (mfa_configuration ${JSON.stringify(mfa ?? null)}). Nothing was deployed.` };
}

/** True when `ampx generate outputs` failed because the branch has no backend yet (its first deploy). */
export function isNoBackendYet(output) {
  return /StackDoesNotExistError|Stack with id \S+ does not exist/.test(String(output ?? ''));
}
