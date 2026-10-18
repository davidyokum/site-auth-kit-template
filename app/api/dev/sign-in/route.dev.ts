/**
 * DEV ONLY: "Sign in as…" (auth-kit/dev). The `.dev.ts` extension makes this a route only under
 * `next dev` (withDevKit in next.config.ts); in a build it isn't a route and nothing imports it.
 * `npm run check:prod-build` fails if a build contains it. Every refusal is a plain 404; the dev
 * server's console says which gate refused (lib/dev/kit.ts lists them).
 *
 *   GET    personas and who's signed in (for the menu)
 *   POST   {"persona":"admin-content"} from this page's origin: sign that persona in for real
 *   DELETE sign out
 */
import { devKit } from '@/lib/dev/kit';

export const GET = devKit.route.GET;
export const POST = devKit.route.POST;
export const DELETE = devKit.route.DELETE;
