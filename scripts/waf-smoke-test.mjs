#!/usr/bin/env node
// `npm run waf:smoke -- --url https://<site>`: after every deploy of an open sign-up site (and a
// 'domains' site with the site web ACL), check from outside that AWS WAF stands in front of the sign-up
// route: a post with no WAF token must get WAF's challenge, never the route's own answer (auth-kit
// ADR 0023). The app can't see the ACL's association, so this is the check. No AWS credentials: it
// only sends one HTTP request to the site, which makes no account.
import { parseArgs } from 'node:util';
import { smokeRequest, smokeVerdict } from './lib/waf-smoke.mjs';

const { values } = parseArgs({ options: { url: { type: 'string' } }, strict: true });
try {
  if (!values.url) throw new Error('Pass the site: npm run waf:smoke -- --url https://www.example.org');
  const { url, init } = smokeRequest(values.url);
  const response = await fetch(url, init);
  const verdict = smokeVerdict(response.status, response.headers);
  console.log(`waf:smoke: ${verdict.message}`);
  process.exitCode = verdict.ok ? 0 : 1;
} catch (error) {
  console.error(`waf:smoke: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
