/**
 * The site's own email (lib/email.ts): the family's sender name, the help mailbox as Reply-To, and
 * the family footer on invites and the owner's alerts (auth-kit's SES mailer and templates). And
 * Cognito's own email (amplify/auth/resource.ts): the same sender name and Reply-To, no footer.
 * No AWS: the mailer gets a fake SES client that records what it would send.
 */
import type { SESv2Client, SendEmailCommandInput } from '@aws-sdk/client-sesv2';
import type { RenderedEmail } from 'auth-kit/admin';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSiteMailer, type EmailSite, replyToAddresses, senderMailbox, withFooter, withFooterText } from '@/lib/email';
import { site } from '@/site.config';

const personal: EmailSite = { name: 'Example Site', family: 'personal', familyUnit: null, email: { fromAddress: 'noreply@example.com', replyTo: 'help@example.com' } };
const unc: EmailSite = { ...personal, family: 'unc', familyUnit: 'Example Unit' };

function fakeSes() {
  const sent: SendEmailCommandInput[] = [];
  const client = { send: async (command: { input: SendEmailCommandInput }) => void sent.push(command.input) } as unknown as SESv2Client;
  return { client, sent };
}

describe('the footer wrappers', () => {
  it('append the family footer after a blank line in text', () => {
    expect(withFooterText('Hello.', personal)).toBe('Hello.\n\nMade by Yokum Lab. Help: help@example.com.');
  });

  it('append it to the HTML as an escaped paragraph, and leave the subject alone', () => {
    const email: RenderedEmail = { subject: 'Hi', text: 'Body', html: '<p>Body</p>' };
    const sneaky: EmailSite = { ...personal, email: { ...personal.email, replyTo: '"<script>"@example.com' } };
    const wrapped = withFooter(email, sneaky);
    expect(wrapped.subject).toBe('Hi');
    expect(wrapped.text).toBe('Body\n\nMade by Yokum Lab. Help: "<script>"@example.com.');
    expect(wrapped.html).toBe('<p>Body</p>\n<p>Made by Yokum Lab. Help: &quot;&lt;script&gt;&quot;@example.com.</p>');
  });
});

describe('the sender and Reply-To', () => {
  it('use the family’s display name, quoted when RFC 5322 needs it, encoded when it isn’t ASCII', () => {
    expect(senderMailbox(personal)).toBe('Example Site <noreply@example.com>');
    expect(senderMailbox(unc)).toBe('"Example Site (UNC)" <noreply@example.com>');
    expect(senderMailbox({ ...personal, name: 'Say "hi"' })).toBe('"Say \\"hi\\"" <noreply@example.com>');
    expect(senderMailbox({ ...personal, name: 'Café' })).toBe(`=?UTF-8?B?${Buffer.from('Café').toString('base64')}?= <noreply@example.com>`);
    expect(() => senderMailbox({ ...personal, name: 'Two\nlines' })).toThrow(/line breaks/);
  });

  it('carry the help mailbox, or nothing when there isn’t one (never noreply)', () => {
    expect(replyToAddresses(personal)).toEqual(['help@example.com']);
    expect(replyToAddresses({ ...personal, email: { ...personal.email, replyTo: null } })).toEqual([]);
  });

  it('default to this site’s config', () => {
    expect(senderMailbox()).toBe(senderMailbox(site));
    expect(replyToAddresses()).toEqual(site.email.replyTo ? [site.email.replyTo] : []);
  });
});

describe('invites and the owner’s alerts (createSiteMailer)', () => {
  const expiresAt = new Date('2026-10-24T21:00:00Z');

  it('send the invite from the family’s sender, with Reply-To and the footer in both parts', async () => {
    const ses = fakeSes();
    await createSiteMailer({ region: 'us-east-1', client: ses.client }, unc).sendInvite({
      email: 'new.person@example.com',
      siteName: unc.name,
      signInUrl: 'https://www.example.com/sign-in',
      expiresAt,
    });
    const [input] = ses.sent;
    expect(input?.FromEmailAddress).toBe('"Example Site (UNC)" <noreply@example.com>');
    expect(input?.ReplyToAddresses).toEqual(['help@example.com']);
    expect(input?.Destination?.ToAddresses).toEqual(['new.person@example.com']);
    const body = input?.Content?.Simple?.Body;
    expect(body?.Text?.Data).toMatch(/You've been invited to Example Site\.[\s\S]*\n\nA UNC-Chapel Hill Example Unit project\. Help: help@example\.com\.$/);
    expect(body?.Html?.Data).toMatch(/<p>A UNC-Chapel Hill Example Unit project\. Help: help@example\.com\.<\/p>$/);
  });

  it('send the Super admin grant alert the same way, to the owner', async () => {
    const ses = fakeSes();
    await createSiteMailer({ region: 'us-east-1', client: ses.client }, personal).superadminGranted({
      siteName: personal.name,
      owners: [{ sub: 'a', email: 'owner@example.com' }],
      grantedTo: { sub: 'b', email: 'deputy@example.com' },
      grantedBy: { sub: 'a', email: 'owner@example.com' },
      via: 'changeRole',
      at: expiresAt,
    });
    const [input] = ses.sent;
    expect(input?.FromEmailAddress).toBe('Example Site <noreply@example.com>');
    expect(input?.ReplyToAddresses).toEqual(['help@example.com']);
    expect(input?.Destination?.ToAddresses).toEqual(['owner@example.com']);
    expect(input?.Content?.Simple?.Body?.Text?.Data).toMatch(/is now a Super admin|a Super admin of Example Site/);
    expect(input?.Content?.Simple?.Body?.Text?.Data).toMatch(/\n\nMade by Yokum Lab\. Help: help@example\.com\.$/);
    expect(input?.Content?.Simple?.Body?.Html?.Data).toMatch(/<p>Made by Yokum Lab\. Help: help@example\.com\.<\/p>$/);
  });

  it('send the ownership transfer alert to both owners, with the footer', async () => {
    const ses = fakeSes();
    await createSiteMailer({ region: 'us-east-1', client: ses.client }, personal).ownershipTransferred({
      siteName: personal.name,
      previousOwner: { sub: 'a', email: 'owner@example.com' },
      newOwner: { sub: 'b', email: 'next.owner@example.com' },
      reason: 'Handing the site over',
      at: expiresAt,
    });
    const [input] = ses.sent;
    expect(input?.Destination?.ToAddresses).toEqual(['owner@example.com', 'next.owner@example.com']);
    expect(input?.Content?.Simple?.Body?.Text?.Data).toMatch(/transferred ownership of Example Site[\s\S]*\n\nMade by Yokum Lab\. Help: help@example\.com\.$/);
  });

  it('send the unused-owner-invite warning with the footer too', async () => {
    const ses = fakeSes();
    await createSiteMailer({ region: 'us-east-1', client: ses.client }, personal).ownerInviteUnused({
      siteName: personal.name,
      owner: { sub: 'a', email: 'owner@example.com' },
      to: { email: 'owner@example.com', kind: 'owner' },
      invitedAt: new Date('2026-10-01T00:00:00Z'),
      expiredAt: new Date('2026-10-08T00:00:00Z'),
      at: expiresAt,
    });
    expect(ses.sent[0]?.Content?.Simple?.Body?.Text?.Data).toMatch(/\n\nMade by Yokum Lab\. Help: help@example\.com\.$/);
  });

  it('send no Reply-To header when the site has no help address', async () => {
    const ses = fakeSes();
    const noHelp: EmailSite = { ...personal, email: { ...personal.email, replyTo: null } };
    await createSiteMailer({ region: 'us-east-1', client: ses.client }, noHelp).sendInvite({ email: 'x@example.com', siteName: 'Example Site', signInUrl: 'https://www.example.com/sign-in', expiresAt });
    expect(ses.sent[0]).not.toHaveProperty('ReplyToAddresses');
    expect(ses.sent[0]?.Content?.Simple?.Body?.Text?.Data).toMatch(/\n\nMade by Yokum Lab\.$/);
  });
});

describe('Cognito’s own email (amplify/auth/resource.ts)', () => {
  afterEach(() => {
    vi.doUnmock('@/site.config');
  });

  // Importing the resource runs auth-kit's preset validation, so this also proves the pool accepts
  // the family's sender name. (Amplify allows one defineAuth per process: one import per file.)
  it('comes from the family’s sender name, with the help mailbox as Reply-To', async () => {
    vi.resetModules();
    vi.doMock('@/site.config', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/site.config')>();
      const email = { fromAddress: 'noreply@example.com', replyTo: 'help@example.com' };
      return { ...actual, site: { ...actual.site, name: 'Example Site', family: 'unc', familyUnit: null, email } };
    });
    const { authOptions } = await import('@/amplify/auth/resource');
    expect(authOptions.email).toEqual({ fromAddress: 'noreply@example.com', fromName: 'Example Site (UNC)', replyTo: 'help@example.com' });
  });
});
