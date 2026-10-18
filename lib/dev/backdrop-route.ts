/**
 * DEV ONLY: the backdrop picker's write route (app/api/dev/backdrop/route.dev.ts, a route only under
 * `next dev`). POST `{ style, seed, styleVersion }` writes it into site.config.ts, locked, keeping the
 * previous file as site.config.ts.bak, and prints the change in the dev server's terminal.
 *
 * It changes a file on this computer, so it answers 404 unless every gate passes: NODE_ENV is
 * development; the Host, the URL, and any X-Forwarded-Host are loopback (localhost, *.localhost,
 * 127.0.0.1); no proxy header names another client; and the request comes from the page itself
 * (Origin is this host, and the browser says same-origin). The choice is checked before anything is
 * written (scripts/lib/backdrop-config.mjs).
 */
import { checkDevSignInGates, devGateInputFor } from 'auth-kit/dev';
import { describeChange, writeBackdropChoice } from '@/scripts/lib/backdrop-config.mjs';

export interface BackdropRouteOptions {
  /** The project root (where site.config.ts is). */
  root: string;
  env?: { NODE_ENV?: string };
  log?: (line: string) => void;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export function createBackdropRoute(options: BackdropRouteOptions) {
  const log = options.log ?? ((line: string) => console.log(line));
  return {
    async POST(request: Request): Promise<Response> {
      const env = options.env ?? process.env;
      const refuse = (why: string) => {
        log(`backdrop picker: refused a write (${why}).`);
        return new Response('Not found', { status: 404 });
      };
      if (env.NODE_ENV !== 'development') return refuse('not next dev');
      // auth-kit's localhost gates (the dev sign-in flag doesn't apply to this route).
      const gates = checkDevSignInGates({ ...devGateInputFor(request, { NODE_ENV: env.NODE_ENV }), flag: '1' });
      if (!gates.allowed) return refuse(`gates: ${gates.failed.join(', ')}`);
      const host = request.headers.get('host');
      if (request.headers.get('origin') !== `http://${host}`) return refuse('not from this page');
      const site = request.headers.get('sec-fetch-site');
      if (site !== null && site !== 'same-origin') return refuse('not from this page');
      if (!/^application\/json\b/i.test(request.headers.get('content-type') ?? '')) return json(415, { error: 'Send JSON.' });
      let choice: unknown;
      try {
        choice = await request.json();
      } catch {
        return json(400, { error: 'That isn’t JSON.' });
      }
      try {
        const result = await writeBackdropChoice(options.root, choice);
        const change = describeChange(result);
        log(`backdrop picker: ${change}`);
        return json(200, { message: 'Saved and locked. Commit site.config.ts.', detail: change });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`backdrop picker: didn't write site.config.ts: ${message}`);
        return json(400, { error: message });
      }
    },
  };
}

export const backdropRoute = createBackdropRoute({ root: process.cwd() });
