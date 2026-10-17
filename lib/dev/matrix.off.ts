/**
 * What `@/dev-matrix` means in every build (and in type checks): no overrides, ever.
 * Under `next dev`, withDevKit points the alias at matrix.on.ts instead. See lib/dev/README.md.
 */
import type { MatrixOverrides } from './matrix-types';

export function matrixOverrides(): MatrixOverrides | null {
  return null;
}
