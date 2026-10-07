import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { IncomingMessage, ServerResponse } from 'node:http';

// The game page, served by the room server itself (owner: everything on one Fly.io app: one sign-up, one command to update both). The
// page is the `npm run build` output (dist/). Files are read once and kept, gzipped for browsers that take it. Only files inside the
// folder are ever served. Hashed build files (assets/) never change, so browsers keep them; everything else is checked each visit.

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};
const SQUEEZE = new Set(['.html', '.js', '.css', '.json', '.wasm', '.svg', '.ttf', '.otf']); // (images and sound are already compressed)

export function siteHandler(root: string) {
  root = resolve(root);
  const kept = new Map<string, { raw: Buffer; gz: Buffer | null }>();
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    let path: string;
    try { path = decodeURIComponent((req.url ?? '/').split('?')[0]); } catch { res.writeHead(400); res.end(); return; }
    let file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(404); res.end(); return; } // nothing outside the folder
    try { if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html'); } catch { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
    let f = kept.get(file);
    if (!f) {
      try { const raw = await readFile(file); f = { raw, gz: SQUEEZE.has(extname(file)) ? gzipSync(raw) : null }; kept.set(file, f); }
      catch { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
    }
    const gz = !!f.gz && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      ...(gz ? { 'content-encoding': 'gzip', vary: 'accept-encoding' } : {}),
    });
    res.end(req.method === 'HEAD' ? undefined : gz ? f.gz : f.raw);
  };
}
