/**
 * DEV ONLY: the backdrop picker's "Use this one" (lib/dev/backdrop-route.ts). The `.dev.ts`
 * extension makes this a route only under `next dev`; in a build it isn't a route and nothing
 * imports it. Every refusal is a plain 404; the dev server's terminal says why.
 *
 *   POST {"style":"contours","seed":"k3f9x2ab","styleVersion":1} from the picker page
 */
import { backdropRoute } from '@/lib/dev/backdrop-route';

export const POST = backdropRoute.POST;
