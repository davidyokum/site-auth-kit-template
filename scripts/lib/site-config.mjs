// Loads site.config.ts from a plain Node script (no tsx, no Next): TypeScript's own transpiler turns
// site.config.ts and site.families.ts into JavaScript in a temporary folder, which is imported and
// then removed. Type-only imports (auth-kit's types) disappear in the transpile.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

/**
 * @param {string} root the project root
 * @returns {Promise<{ site: Record<string, unknown> & { name: string, family: string, backdrop: unknown } }>}
 */
export async function loadSiteConfig(root) {
  const dir = mkdtempSync(join(tmpdir(), 'site-config-'));
  try {
    for (const name of ['site.config', 'site.families']) {
      const source = readFileSync(join(root, `${name}.ts`), 'utf8');
      const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
        fileName: `${name}.ts`,
      });
      // Relative imports between the two files get the .mjs extension Node's loader needs.
      writeFileSync(join(dir, `${name}.mjs`), outputText.replace(/from\s+['"]\.\/(site\.families)['"]/g, "from './$1.mjs'"));
    }
    return await import(pathToFileURL(join(dir, 'site.config.mjs')).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
