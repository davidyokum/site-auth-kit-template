/**
 * The site's own email (lib/email.ts) matches the sign-in card (auth-kit ADR 0024; register E4a): the
 * family's sender name, the help address in effect as Reply-To, no letterhead, and the card's footer
 * ("{identity line}. Help: {address}."; personal sites: the help line alone) on every email, invites
 * and alerts alike. And Cognito's own email (amplify/auth/resource.ts): the same sender name, with the
 * help address as Reply-To. No AWS: the mailer gets a fake SES client that records what it would send.
 */
import type { SESv2Client, SendEmailCommandInput } from '@aws-sdk/client-sesv2';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSiteMailer, inCardLayout, type MailSite, senderMailbox } from '@/lib/email';
import { site } from '@/site.config';

const personal: MailSite = { name: 'Example Site', family: 'personal', email: { fromAddress: 'sign-in@example.com', replyTo: 'help@example.com' } };
const unc: MailSite = { ...personal, family: 'unc' };
const signInUrl = 'https://www.example.com/sign-in';

function fakeSes() {
  const sent: SendEmailCommandInput[] = [];
  const client = { send: async (command: { input: SendEmailCommandInput }) => void sent.push(command.input) } as unknown as SESv2Client;
  return { client, sent };
}

const textOf = (input: SendEmailCommandInput | undefined) => input?.Content?.Simple?.Body?.Text?.Data ?? '';
const htmlOf = (input: SendEmailCommandInput | undefined) => input?.Content?.Simple?.Body?.Html?.Data ?? '';

describe('the sender', () => {
  it('is the site’s sign-in@ mailbox under the family’s display name, quoted when RFC 5322 needs it (register A10, E4a)', () => {
    expect(senderMailbox(personal)).toBe('Example Site <sign-in@example.com>');
    expect(senderMailbox(unc)).toBe('"Example Site (UNC)" <sign-in@example.com>');
    expect(() => senderMailbox({ ...personal, name: 'Two\nlines' })).toThrow(/line breaks/);
  });

  it('is the family’s shared sender when the site has none of its own (personal sites: sign-in@yokum.app)', () => {
    expect(senderMailbox({ ...personal, email: { fromAddress: null, replyTo: null } })).toBe('Example Site <sign-in@yokum.app>');
    expect(() => senderMailbox({ ...unc, email: { fromAddress: null, replyTo: 'help@example.com' } })).toThrow(/needs a sender[\s\S]*email\.fromAddress/);
  });

  it('refuses a sender that can’t be replied to, or isn’t the sign-in@ mailbox (auth-kit refuses both everywhere)', () => {
    expect(() => senderMailbox({ ...personal, email: { fromAddress: 'noreply@example.com' } })).toThrow(/can't be replied to/);
    expect(() => senderMailbox({ ...personal, email: { fromAddress: 'reports@example.com' } })).toThrow(/sign-in@ mailbox/);
  });

  it('defaults to this site’s config', () => {
    expect(senderMailbox()).toBe(senderMailbox(site));
  });
});

describe('the card layout (inCardLayout)', () => {
  it('ends with the help line alone on a personal site, and the identity line first on a work site, in text and HTML', () => {
    const plain = { subject: 'Hello', text: 'First line.\nSecond line.' };
    const mine = inCardLayout(plain, { siteName: 'Example Site', theme: 'personal', signInUrl, helpEmail: 'help@example.com' });
    expect(mine.text).toBe('First line.\n\nSecond line.\n\nHelp: help@example.com.');
    expect(mine.html).toContain('Help: help@example.com.');
    expect(mine.html).not.toContain('This site is managed by');
    const work = inCardLayout(plain, { siteName: 'Example Site', theme: 'unc', signInUrl, helpEmail: 'help@example.com' });
    expect(work.text).toMatch(/This site is managed by UNC-Chapel Hill\. Help: help@example\.com\.$/);
    expect(work.preheader).toBe('First line.');
  });

  it('escapes what it lays out', () => {
    const laid = inCardLayout({ subject: 'Hi', text: '<script>alert(1)</script>' }, { siteName: 'Example Site', theme: 'personal', signInUrl, helpEmail: 'help@example.com' });
    expect(laid.html).not.toContain('<script>alert');
    expect(laid.html).toContain('&lt;script&gt;');
  });
});

describe('the site’s mailer (createSiteMailer)', () => {
  const expiresAt = new Date('2026-10-24T21:00:00Z');

  it('sends the invite from the family’s sender, with the help address as Reply-To and the card’s footer', async () => {
    const ses = fakeSes();
    await createSiteMailer({ region: 'us-east-1', client: ses.client, help: 'help@example.com', signInUrl }, unc).sendInvite({
      email: 'new.person@example.com',
      siteName: unc.name,
      signInUrl,
      expiresAt,
    });
    const [input] = ses.sent;
    expect(input?.FromEmailAddress).toBe('"Example Site (UNC)" <sign-in@example.com>');
    expect(input?.ReplyToAddresses).toEqual(['help@example.com']);
    expect(input?.Destination?.ToAddresses).toEqual(['new.person@example.com']);
    expect(textOf(input)).toMatch(/This site is managed by UNC-Chapel Hill\. Help: help@example\.com\.$/);
    expect(htmlOf(input)).toContain('This site is managed by UNC-Chapel Hill. Help: help@example.com.');
  });

  it('reads the help address in effect for each email (a Super admin’s override shows at once)', async () => {
    const ses = fakeSes();
    let address = 'help@example.com';
    const help = { effective: async () => ({ address, source: 'config' as const }) };
    const mailer = createSiteMailer({ region: 'us-east-1', client: ses.client, help, signInUrl }, personal);
    await mailer.sendInvite({ email: 'a@example.com', siteName: personal.name, signInUrl, expiresAt });
    address = 'desk@example.com';
    await mailer.sendInvite({ email: 'b@example.com', siteName: personal.name, signInUrl, expiresAt });
    expect(ses.sent.map((i) => i.ReplyToAddresses)).toEqual([['help@example.com'], ['desk@example.com']]);
    expect(textOf(ses.sent[1])).toMatch(/Help: desk@example\.com\.$/);
  });

  it('lays the Super admin grant alert out like the card, with the footer, to the owner', async () => {
    const ses = fakeSes();
    await createSiteMailer({ region: 'us-east-1', client: ses.client, help: 'help@example.com', signInUrl }, personal).superadminGranted({
      siteName: personal.name,
      owners: [{ sub: 'a', email: 'owner@example.com' }],
      grantedTo: { sub: 'b', email: 'deputy@example.com' },
      grantedBy: { sub: 'a', email: 'owner@example.com' },
      via: 'changeRole',
      at: expiresAt,
    });
    const [input] = ses.sent;
    expect(input?.FromEmailAddress).toBe('Example Site <sign-in@example.com>');
    expect(input?.ReplyToAddresses).toEqual(['help@example.com']);
    expect(input?.Destination?.ToAddresses).toEqual(['owner@example.com']);
    expect(textOf(input)).toMatch(/a Super admin of Example Site[\s\S]*\n\nHelp: help@example\.com\.$/);
    expect(htmlOf(input)).toMatch(/^<!doctype html>/);
  });

  it('sends the ownership transfer alert to both owners, and the unused-owner-invite warning, with the footer', async () => {
    const ses = fakeSes();
    const mailer = createSiteMailer({ region: 'us-east-1', client: ses.client, help: 'help@example.com', signInUrl }, personal);
    await mailer.ownershipTransferred({
      siteName: personal.name,
      previousOwner: { sub: 'a', email: 'owner@example.com' },
      newOwner: { sub: 'b', email: 'next.owner@example.com' },
      reason: 'Handing the site over',
      at: expiresAt,
    });
    await mailer.ownerInviteUnused({
      siteName: personal.name,
      owner: { sub: 'a', email: 'owner@example.com' },
      to: { email: 'owner@example.com', kind: 'owner' },
      invitedAt: new Date('2026-10-01T00:00:00Z'),
      expiredAt: new Date('2026-10-08T00:00:00Z'),
      at: expiresAt,
    });
    expect(ses.sent[0]?.Destination?.ToAddresses).toEqual(['owner@example.com', 'next.owner@example.com']);
    for (const input of ses.sent) expect(textOf(input)).toMatch(/\n\nHelp: help@example\.com\.$/);
  });

  it('gives a project Manager’s invite (which carries no theme or help address) the family’s footer too', async () => {
    const ses = fakeSes();
    await createSiteMailer({ region: 'us-east-1', client: ses.client, help: 'help@example.com', signInUrl }, unc).sendInvite({
      email: 'new.person@example.com',
      siteName: unc.name,
      signInUrl,
      expiresAt,
      item: { noun: 'project', name: 'Roads 2027', role: 'contributor', invitedBy: 'Pat Lee' },
    });
    expect(textOf(ses.sent[0])).toMatch(/Roads 2027[\s\S]*This site is managed by UNC-Chapel Hill\. Help: help@example\.com\.$/);
  });

  it('sends an already-rendered email (account notices) as is, from the site’s sender', async () => {
    const ses = fakeSes();
    await createSiteMailer({ region: 'us-east-1', client: ses.client, help: 'help@example.com', signInUrl }, personal).sendEmail({
      to: ['someone@example.com'],
      email: { subject: 'Hi', text: 'Body', html: '<p>Body</p>' },
    });
    expect(ses.sent[0]?.FromEmailAddress).toBe('Example Site <sign-in@example.com>');
    expect(ses.sent[0]?.ReplyToAddresses).toEqual(['help@example.com']);
    expect(textOf(ses.sent[0])).toBe('Body');
  });
});

describe('Cognito’s own email (amplify/auth/resource.ts)', () => {
  afterEach(() => {
    vi.doUnmock('@/site.config');
  });

  // Importing the resource runs auth-kit's preset validation, so this also proves the pool accepts
  // the family's sender name and the help address. (Amplify allows one defineAuth per process: one
  // import per file.)
  it('comes from the site’s sign-in@ mailbox under the family’s sender name, with the help address as Reply-To', async () => {
    vi.resetModules();
    vi.doMock('@/site.config', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/site.config')>();
      const email = { fromAddress: 'sign-in@reports.example.org', replyTo: 'reports-help@example.org' };
      return { ...actual, site: { ...actual.site, name: 'Example Site', family: 'unc', email } };
    });
    const { authOptions } = await import('@/amplify/auth/resource');
    expect(authOptions.email).toEqual({ fromAddress: 'sign-in@reports.example.org', fromName: 'Example Site (UNC)', family: 'unc', replyTo: 'reports-help@example.org' });
    expect(authOptions.accountCreation).toEqual(site.accountCreation);
    expect(authOptions.codeLifetimeMinutes).toBe(site.codeLifetimeMinutes);
  });
});
