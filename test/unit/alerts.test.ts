import type { AuditEvent } from 'auth-kit/admin';
import { describe, expect, it } from 'vitest';
import { describeChange, isGrantOrRemoval } from '@/lib/alerts';

const event = (over: Partial<AuditEvent>): AuditEvent => ({
  id: 'a1',
  at: '2026-10-17T12:00:00.000Z',
  startedAt: '2026-10-17T12:00:00.000Z',
  phase: 'result',
  outcome: 'ok',
  actor: { sub: 'admin-sub', email: 'admin@example.com' },
  action: 'people.changeRole',
  target: { sub: 'target-sub', email: 'person@example.com' },
  ...over,
});

describe('grants and removals alert a named person (lib/alerts.ts)', () => {
  it('alerts on role changes, disables, re-enables, and deletes', () => {
    for (const action of ['people.changeRole', 'people.disable', 'people.enable', 'people.delete']) {
      expect(isGrantOrRemoval(event({ action }))).toBe(true);
    }
  });

  it('alerts on an invite that grants an admin role, not on a member invite', () => {
    expect(isGrantOrRemoval(event({ action: 'people.invite', after: { role: 'editor' } }))).toBe(true);
    expect(isGrantOrRemoval(event({ action: 'people.invite', after: { role: 'member' } }))).toBe(false);
  });

  it('stays quiet for changes that grant or remove nothing, and for failed attempts', () => {
    for (const action of ['people.resend', 'people.signOutEverywhere', 'tickets.create']) expect(isGrantOrRemoval(event({ action }))).toBe(false);
    expect(isGrantOrRemoval(event({ outcome: 'failed' }))).toBe(false);
  });

  it('says who, to whom, what, before and after, why, and when', () => {
    const { subject, text } = describeChange(
      event({ before: { adminRole: 'viewer' }, after: { adminRole: 'editor' }, reason: 'Covering for a colleague' }),
    );
    expect(subject).toContain('changeRole');
    for (const part of ['admin@example.com', 'person@example.com', 'viewer', 'editor', 'Covering for a colleague', '2026-10-17']) {
      expect(text).toContain(part);
    }
  });
});
