// The WAF smoke test's pure half (auth-kit README section 11, ADR 0023): what to send, and what the
// answer means. No I/O here, so the unit tests cover it.

/** The request: a sign-up POST from the site's own origin, with no WAF token. */
export function smokeRequest(siteUrl) {
  let url;
  try {
    url = new URL(siteUrl);
  } catch {
    throw new Error(`"${siteUrl}" isn't a URL: pass the site's address, e.g. --url https://www.example.org`);
  }
  if (url.protocol !== 'https:') throw new Error('The smoke test checks a deployed site: its address starts with https://.');
  return {
    url: new URL('/api/auth/sign-up', url.origin).toString(),
    init: { method: 'POST', redirect: 'manual', headers: { origin: url.origin, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'smoke-test@example.org' }) },
  };
}

/** What the answer means: AWS WAF's challenge (the ACL is in front of the route), or why not. */
export function smokeVerdict(status, headers) {
  const action = headers.get('x-amzn-waf-action');
  if (status === 202 && action === 'challenge') return { ok: true, message: 'AWS WAF challenged the sign-up post (202, x-amzn-waf-action: challenge): the site web ACL is in front of the route.' };
  if (status === 404) return { ok: false, message: 'The sign-up route answered 404: this site takes no sign-ups (site.config.ts accountCreation), or the address is wrong.' };
  return {
    ok: false,
    message:
      `Expected AWS WAF's challenge (202 with x-amzn-waf-action: challenge), got ${status}${action ? ` (x-amzn-waf-action: ${action})` : ''}. ` +
      "The route answered itself, so the site web ACL isn't associated with the Amplify app (Hosting → Firewall) or its challenge rule isn't in effect.",
  };
}
