export declare function loadSiteConfig(root: string): Promise<{ site: Record<string, unknown> & { name: string; family: string; backdrop: unknown } }>;
export declare function loadSiteModules(root: string): Promise<{
  config: { site: Record<string, unknown> & { name: string; family: string; backdrop: unknown } };
  families: { FAMILY_HELP_MAILBOX: Record<string, string | null>; SITE_FAMILIES: readonly string[]; FAMILY_NAMES_OWNER: Record<string, boolean> };
}>;
