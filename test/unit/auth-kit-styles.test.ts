/**
 * app/globals.css carries auth-kit's optional `authKitStyles` (so the CSP needs no inline <style>).
 * They must stay in step: since auth-kit 0.1.2 they also keep TOTPEnrollmentGate's content hidden
 * until its check passes (auth-kit ADR 0015), so a stale copy could show what the gate hides.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { authKitStyles } from 'auth-kit/client';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(import.meta.dirname, '..', '..', 'app', 'globals.css'), 'utf8');

describe('app/globals.css', () => {
  it('has every rule of the installed auth-kit’s authKitStyles, verbatim', () => {
    const rules = authKitStyles.split('\n').map((line) => line.trim()).filter(Boolean);
    expect(rules.length).toBeGreaterThan(10);
    expect(rules.filter((rule) => !css.includes(rule))).toEqual([]);
  });
});
