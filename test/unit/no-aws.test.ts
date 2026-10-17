/**
 * The canary for "tests make no AWS calls": with the unit tests' environment (vitest.config.ts),
 * a real SDK call can't find credentials, so it fails before any request leaves this machine.
 * If this test ever passes a call through, the environment block is broken: fix it first.
 */
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { describe, expect, it } from 'vitest';

describe('tests can’t reach AWS', () => {
  it('a real SDK call fails at credential lookup', async () => {
    const client = new DynamoDBClient({ region: 'us-east-1', maxAttempts: 1 });
    await expect(client.send(new ListTablesCommand({ Limit: 1 }))).rejects.toThrow(/credential|profile|could not load/i);
  });
});
