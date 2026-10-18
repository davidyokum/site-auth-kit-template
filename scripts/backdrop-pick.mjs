#!/usr/bin/env node
// npm run backdrop:pick: opens the backdrop picker, a local page with nine variations behind the
// site's real sign-in card (app/dev/backdrops/page.dev.tsx). "Use this one" writes the choice into
// site.config.ts, locked, with a backup. No AWS: the picker needs only `next dev`.
//
// Starts the dev server (npm run dev) unless one is already answering on the site's port, then
// opens the page. The page and its write route exist only under `next dev`; production builds
// don't contain them (npm run check:prod-build).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSiteConfig } from './lib/site-config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { site } = await loadSiteConfig(root);
const dev = /** @type {{ app: string, port: number }} */ (site.dev);
const pageUrl = `http://${dev.app}.localhost:${dev.port}/dev/backdrops`;
const probeUrl = `http://127.0.0.1:${dev.port}/dev/backdrops`;

async function answering() {
  try {
    const response = await fetch(probeUrl, { headers: { host: `${dev.app}.localhost:${dev.port}` }, signal: AbortSignal.timeout(1500) });
    return response.status < 500;
  } catch {
    return false;
  }
}

function open(url) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const result = spawnSync(command, args, { stdio: 'ignore' });
  if (result.status !== 0) console.log(`Open ${url} in your browser.`);
}

// The app needs an amplify_outputs.json to start. Without a sandbox, the clearly fake placeholder
// does (nothing can sign in with it; the picker doesn't need to).
if (!existsSync(join(root, 'amplify_outputs.json'))) {
  console.log('backdrop:pick: no amplify_outputs.json; using the placeholder (fake IDs, nothing can sign in).');
  spawnSync(process.execPath, [join(root, 'scripts', 'use-placeholder-outputs.mjs')], { stdio: 'inherit' });
}

if (await answering()) {
  console.log(`backdrop:pick: the dev server is running. Opening ${pageUrl}`);
  open(pageUrl);
} else {
  console.log(`backdrop:pick: starting the dev server (npm run dev); the picker opens at ${pageUrl}. Ctrl-C to stop.`);
  const server = spawn('npm', ['run', 'dev'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  const stop = () => server.kill('SIGINT');
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  server.on('exit', (code) => process.exit(code ?? 0));
  for (let i = 0; i < 120; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (await answering()) {
      open(pageUrl);
      console.log(`backdrop:pick: ${pageUrl}  ("Use this one" writes site.config.ts and prints the change here)`);
      break;
    }
  }
}
