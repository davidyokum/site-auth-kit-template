/**
 * What `@/dev-matrix` means in every build (and in type checks): no overrides, ever.
 * Under `next dev`, withDevKit points the alias at matrix.on.ts instead. See lib/dev/README.md.
 * The import is a type only: nothing from auth-kit/testing reaches a build.
 */
import type { MatrixServerOverrides } from 'auth-kit/testing/matrix-server';

export function matrixOverrides(): MatrixServerOverrides | null {
  return null;
}
