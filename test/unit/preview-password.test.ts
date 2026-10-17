import { describe, expect, it } from 'vitest';
import { basicAuthCredentials, parsePreviewArgs, previewPasswordProblem, previewPasswordRequest } from '../../scripts/lib/preview-password.mjs';

const APP = 'dexample0app0';

describe('branch passwords for previews (scripts/preview-password.mjs)', () => {
  it('targets one branch, or the branches Amplify creates later', () => {
    expect(parsePreviewArgs(['--app-id', APP, '--branch', 'feature/login']).target).toEqual({ kind: 'branch', branch: 'feature/login' });
    expect(parsePreviewArgs(['--app-id', APP, '--auto-branches']).target).toEqual({ kind: 'auto' });
  });

  it('needs an app ID and exactly one target', () => {
    expect(() => parsePreviewArgs(['--branch', 'x'])).toThrow(/app-id/);
    expect(() => parsePreviewArgs(['--app-id', APP])).toThrow(/exactly one/);
    expect(() => parsePreviewArgs(['--app-id', APP, '--branch', 'x', '--auto-branches'])).toThrow(/exactly one/);
    expect(() => parsePreviewArgs(['--app-id', APP, '--password', 'x'])).toThrow(/unknown option/);
  });

  it('won’t lock the live branch unless asked (before launch)', () => {
    expect(() => parsePreviewArgs(['--app-id', APP, '--branch', 'main'])).toThrow(/live site/);
    expect(parsePreviewArgs(['--app-id', APP, '--branch', 'main', '--allow-live-branch']).allowLive).toBe(true);
  });

  it('wants a long, manager-generated password', () => {
    expect(previewPasswordProblem('short')).toMatch(/16/);
    expect(previewPasswordProblem('has:colon:but-long-enough')).toMatch(/:/);
    expect(previewPasswordProblem('correct-horse-battery-staple')).toBeNull();
  });

  it('builds the AWS CLI input (never command-line arguments) for update-branch and update-app', () => {
    const branch = previewPasswordRequest(parsePreviewArgs(['--app-id', APP, '--branch', 'dev']), 'correct-horse-battery-staple');
    expect(branch.command).toEqual(['amplify', 'update-branch']);
    expect(branch.input).toEqual({ appId: APP, branchName: 'dev', enableBasicAuth: true, basicAuthCredentials: basicAuthCredentials('preview', 'correct-horse-battery-staple') });
    const auto = previewPasswordRequest(parsePreviewArgs(['--app-id', APP, '--auto-branches']), 'correct-horse-battery-staple');
    expect(auto).toMatchObject({ command: ['amplify', 'update-app'], input: { autoBranchCreationConfig: { enableBasicAuth: true } } });
    expect(Buffer.from(basicAuthCredentials('preview', 'pw'), 'base64').toString()).toBe('preview:pw');
  });
});
