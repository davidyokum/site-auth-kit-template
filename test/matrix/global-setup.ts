/**
 * Starts the real app under `next dev` for the auth matrix, with no AWS at all, through auth-kit's
 * `startMatrixServer` (auth-kit ADR 0016):
 *
 * - a local test issuer signs a session for each persona (test/matrix/personas.ts), with the pool
 *   and client IDs from amplify_outputs.json (CI uses the placeholder; locally, your sandbox's);
 * - the dev server gets AUTH_KIT_MATRIX=1 and the fixture, so the app's `@/dev-matrix` (auth-kit's
 *   matrix server mode) trusts only the issuer's keys and answers from a scripted Cognito, and the
 *   proxy steps aside for the matrix's "without proxy" pass (only in development, only on loopback);
 * - auth-kit strips AWS credentials and adds AWS_BLOCKED_ENV and ALLOW_DEV_SIGNIN=0, which nothing
 *   here can override, so any AWS call fails loudly.
 *
 * It needs `next build` first: the matrix reads the build's route manifest to know every route.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { type MatrixPersonaSpec, startMatrixServer } from 'auth-kit/testing';
import type { TestProject } from 'vitest/node';
import { type MatrixContext, type MatrixPersonaKey, matrixPersonaSpecs } from './personas';

const ROOT = join(import.meta.dirname, '..', '..');
// A fixed port, so the origin the routes expect can be set before the server starts.
const PORT = Number(process.env.MATRIX_PORT ?? 3210);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  if (!existsSync(join(ROOT, 'amplify_outputs.json'))) {
    throw new Error('auth matrix: no amplify_outputs.json. Run `npm run outputs:placeholder` (or `npm run sandbox`) first.');
  }

  const server = await startMatrixServer<MatrixPersonaKey>({
    cwd: ROOT,
    port: PORT,
    // This site's personas (newMember only on sign-up sites): every key present is a full spec.
    personas: matrixPersonaSpecs() as Record<MatrixPersonaKey, MatrixPersonaSpec>,
    env: {
      // A separate output folder, so a `npm run dev` you have open keeps its own (see next.config.ts).
      SITE_NEXT_DIST_DIR: '.next-matrix',
      // The origin state-changing routes expect (lib/origin.ts): this server's, not app.localhost:3000.
      SITE_DEV_ORIGIN: BASE_URL,
    },
  });

  // Plain strings only: provide() crosses into the test workers.
  const personas = {} as MatrixContext['personas'];
  for (const [name, persona] of Object.entries(server.personas) as [MatrixPersonaKey, (typeof server.personas)[MatrixPersonaKey]][]) {
    const cookie = new Headers(persona.cookie.headers as HeadersInit).get('cookie');
    if (!cookie) throw new Error(`auth matrix: no session cookie for ${name}.`);
    personas[name] = { username: persona.username, sub: persona.sub, email: persona.email, accessToken: persona.accessToken, idToken: persona.idToken, cookie };
  }
  project.provide('matrix', { baseUrl: server.baseUrl, clientId: server.clientId, personas });

  return async () => {
    if (process.env.MATRIX_SHOW_SERVER_LOG === '1') console.log(server.log());
    await server.stop();
  };
}
