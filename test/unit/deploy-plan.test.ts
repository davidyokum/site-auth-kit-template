/**
 * `npm run deploy` (scripts/deploy.mjs, scripts/lib/deploy-plan.mjs): it refuses until the owner's
 * decisions are in, and hands auth-kit's deploy everything from site.config.ts and deploy.config.json.
 */
import { describe, expect, it } from 'vitest';
import { deployArgs, deployBlockers } from '@/scripts/lib/deploy-plan.mjs';
import { FAMILY_HELP_MAILBOX } from '@/site.families';

const ready = {
  name: 'Budget Reports',
  family: 'personal',
  ownerEmail: 'owner@example.org',
  passkeys: { relyingPartyId: 'budget-reports.yokum.app' },
  backdrop: { style: 'contours', seed: 'mfpxqqpj', styleVersion: 2, locked: true, chosen: 'owner' },
  email: { replyTo: null },
};
const config = { repo: 'example/budget-reports', webAcl: 'own' };

describe('deployBlockers', () => {
  it('lets a site whose owner has decided deploy', () => {
    expect(deployBlockers(ready, config)).toEqual([]);
  });

  it('stops without an address, the owner’s backdrop, a repo, or a web ACL', () => {
    const blockers = deployBlockers({ ...ready, passkeys: false, backdrop: { ...ready.backdrop, chosen: undefined } }, { repo: null, webAcl: null });
    expect(blockers.join('\n')).toMatch(/no address/);
    expect(blockers.join('\n')).toMatch(/isn't the owner's choice/);
    expect(blockers.join('\n')).toMatch(/no repo/);
    expect(blockers.join('\n')).toMatch(/no webAcl/);
  });
});

describe('deployArgs', () => {
  it('passes the site’s address, owner, name, family, and help address (the family’s when the site uses it)', () => {
    expect(deployArgs(ready, FAMILY_HELP_MAILBOX, { repo: 'example/budget-reports' }, ['--yes'])).toEqual([
      '--no-install', 'auth-kit', 'deploy',
      '--repo', 'example/budget-reports',
      '--domain', 'budget-reports.yokum.app',
      '--owner-email', 'owner@example.org',
      '--site-name', 'Budget Reports',
      '--family', 'personal',
      '--help-address', FAMILY_HELP_MAILBOX.personal,
      '--yes',
    ]);
  });

  it('refuses a flag it sets itself', () => {
    expect(() => deployArgs(ready, FAMILY_HELP_MAILBOX, { repo: 'example/x' }, ['--domain', 'other.example.org'])).toThrow(/Don't pass --domain/);
  });
});
