import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { AuditEvent } from 'auth-kit/admin';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { alertOnPeopleChange, describeChange, isGrantOrRemoval } from '@/lib/alerts';

// A named alert recipient and a help address, on a personal site with a known name and sender, so
// these tests don't depend on how a site fills in site.config.ts.
vi.mock('@/site.config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/site.config')>();
  return {
    ...actual,
    site: {
      ...actual.site,
      name: 'Example Site',
      family: 'personal',
      familyUnit: null,
      alertEmails: ['security@example.com'],
      email: { fromAddress: 'noreply@example.com', replyTo: 'help@example.com' },
    },
  };
});

// No AWS: every SES call is answered here.
const ses = mockClient(SESv2Client);

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

describe('sending the alert (lib/alerts.ts → SES)', () => {
  beforeEach(() => {
    ses.reset();
    ses.on(SendEmailCommand).resolves({ MessageId: 'test-message' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('emails the named people from the family’s sender, with the help mailbox as Reply-To and the family footer', async () => {
    await alertOnPeopleChange(event({ action: 'people.disable' }));
    const calls = ses.commandCalls(SendEmailCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0]!.args[0].input;
    expect(input.FromEmailAddress).toBe('Example Site <noreply@example.com>');
    expect(input.ReplyToAddresses).toEqual(['help@example.com']);
    expect(input.Destination?.ToAddresses).toEqual(['security@example.com']);
    expect(input.Content?.Simple?.Subject?.Data).toContain('disable');
    expect(input.Content?.Simple?.Body?.Text?.Data).toMatch(/Activity page[\s\S]*\n\nMade by Yokum Lab\. Help: help@example\.com\.$/);
  });

  it('sends nothing for a change that grants or removes nothing', async () => {
    await alertOnPeopleChange(event({ action: 'people.resend' }));
    expect(ses.commandCalls(SendEmailCommand)).toHaveLength(0);
  });
});
