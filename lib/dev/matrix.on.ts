/**
 * DEV ONLY: what `@/dev-matrix` means under `next dev`: auth-kit's matrix server mode (auth-kit
 * ADR 0016). Never in a build: the alias points at matrix.off.ts there, and auth-kit's module
 * carries a marker `auth-kit check-prod-build` fails on.
 *
 * With AUTH_KIT_MATRIX=1 and the fixture `startMatrixServer` passes (test/matrix/global-setup.ts),
 * the server verifies tokens against the test issuer's public keys, asks a scripted Cognito about
 * each test person, keeps the audit log and the app's own stores in memory, and refuses to send
 * email or change accounts. Without the flag it returns null and the app talks to AWS as usual
 * (your sandbox). See lib/dev/README.md.
 */
export { matrixServerOverrides as matrixOverrides } from 'auth-kit/testing/matrix-server';
