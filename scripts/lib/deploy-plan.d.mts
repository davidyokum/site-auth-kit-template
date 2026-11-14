export declare function deployBlockers(site: { name: string; backdrop: unknown; passkeys: unknown; ownerEmail: unknown }, config: { repo: string | null; webAcl: string | null }): string[];
export declare function deployArgs(
  site: { name: string; family: string; ownerEmail: string; passkeys: { relyingPartyId: string }; email?: { replyTo?: unknown } },
  familyHelpMailbox: Record<string, string | null>,
  config: { repo: string },
  passthrough?: string[],
): string[];
