/**
 * Starts the real app under `next dev` for the auth matrix, with no AWS at all:
 *
 * - a local test issuer (auth-kit/testing) signs tokens for each persona, with the pool and client
 *   IDs from amplify_outputs.json (CI uses the placeholder; locally, your sandbox's);
 * - the dev server gets AUTH_KIT_MATRIX=1 (auth-kit's proxy steps aside for the matrix's
 *   "without proxy" pass, only in development and only on loopback) and the fixture
 *   (lib/dev/matrix.on.ts: the issuer's public keys, a scripted Cognito, in-memory data);
 * - AWS credentials are stripped and the profile points nowhere, so any AWS call fails loudly.
 *
 * It needs `next build` first: the matrix reads the build's route manifest to know every route.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestIssuer } from 'auth-kit/testing';
import type { TestProject } from 'vitest/node';
import { MATRIX_FIXTURE_ENV, type MatrixFixture } from '@/lib/dev/matrix-types';
import { AWS_BLOCKED_ENV } from '../aws-blocked-env';
import { MATRIX_PERSONAS, type MatrixContext } from './personas';

const ROOT = join(import.meta.dirname, '..', '..');
const PORT = Number(process.env.MATRIX_PORT ?? 3210);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const READY_TIMEOUT_MS = 180_000;

function readOutputs(): { userPoolId: string; clientId: string } {
  const file = join(ROOT, 'amplify_outputs.json');
  if (!existsSync(file)) {
    throw new Error('auth matrix: no amplify_outputs.json. Run `npm run outputs:placeholder` (or `npm run sandbox`) first.');
  }
  const outputs = JSON.parse(readFileSync(file, 'utf8')) as { auth?: { user_pool_id?: string; user_pool_client_id?: string } };
  const userPoolId = outputs.auth?.user_pool_id;
  const clientId = outputs.auth?.user_pool_client_id;
  if (!userPoolId || !clientId) throw new Error('auth matrix: amplify_outputs.json has no auth.user_pool_id / user_pool_client_id.');
  return { userPoolId, clientId };
}

/** The dev server's environment: the parent's, minus anything that could reach AWS. */
function serverEnv(fixture: MatrixFixture): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (/^AWS_/.test(key) || key === 'NODE_ENV' || key.startsWith('VITEST') || key === 'TEST') continue;
    env[key] = value;
  }
  return {
    ...env,
    AUTH_KIT_MATRIX: '1',
    [MATRIX_FIXTURE_ENV]: JSON.stringify(fixture),
    // Values here win over .env.local (Next doesn't override variables already set).
    ALLOW_DEV_SIGNIN: '0',
    ...AWS_BLOCKED_ENV,
    NEXT_TELEMETRY_DISABLED: '1',
    // A separate output folder, so a `npm run dev` you have open keeps its own (see next.config.ts).
    SITE_NEXT_DIST_DIR: '.next-matrix',
    // The origin state-changing routes expect (lib/origin.ts): this server's, not app.localhost:3000.
    SITE_DEV_ORIGIN: BASE_URL,
  };
}

async function waitForServer(child: ChildProcess, log: () => string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`auth matrix: next dev exited (${child.exitCode}).\n${log()}`);
    try {
      const response = await fetch(`${BASE_URL}/`, { redirect: 'manual' });
      if (response.status === 200) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`auth matrix: next dev wasn't ready within ${READY_TIMEOUT_MS / 1000}s.\n${log()}`);
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const { userPoolId, clientId } = readOutputs();
  const issuer = createTestIssuer({ userPoolId, clientId });

  const users: MatrixFixture['users'] = [];
  const personas = {} as MatrixContext['personas'];
  for (const [name, spec] of Object.entries(MATRIX_PERSONAS) as [keyof typeof MATRIX_PERSONAS, (typeof MATRIX_PERSONAS)[keyof typeof MATRIX_PERSONAS]][]) {
    const sub = randomUUID();
    const email = `${name.toLowerCase()}@matrix.test`;
    // Email-as-username pools give each person a UUID username; the token's `username` is that UUID.
    const username = sub;
    users.push({ username, sub, email, groups: [...spec.groups], ...('cognito' in spec ? spec.cognito : {}) });
    personas[name] = {
      username,
      sub,
      accessToken: issuer.mintAccessToken({ sub, username, groups: spec.groups }),
      idToken: issuer.mintIdToken({ sub, username, groups: spec.groups, email, emailVerified: true }),
    };
  }

  let output = '';
  const child = spawn(join(ROOT, 'node_modules', '.bin', 'next'), ['dev', '--hostname', '127.0.0.1', '--port', String(PORT)], {
    cwd: ROOT,
    // Next.js types NODE_ENV as required; the dev server sets it itself, so it is left out on purpose.
    env: serverEnv({ jwks: issuer.jwks, users }) as NodeJS.ProcessEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  child.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()));
  const log = () => output.split('\n').slice(-40).join('\n');

  const stop = async () => {
    if (child.exitCode === null && child.pid) {
      try {
        process.kill(-child.pid, 'SIGTERM'); // the whole process group: next dev starts workers
      } catch {
        // already gone
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  };

  try {
    await waitForServer(child, log);
  } catch (error) {
    await stop();
    throw error;
  }

  project.provide('matrix', { baseUrl: BASE_URL, clientId, personas });
  return async () => {
    if (process.env.MATRIX_SHOW_SERVER_LOG === '1') console.log(output);
    await stop();
  };
}
