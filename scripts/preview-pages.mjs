import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const siteDir = path.resolve(process.cwd(), 'site');
const port = Number(process.env.PAGES_PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const server = http.createServer((req, res) => {
  const rawUrl = (req.url || '/').split('?')[0];
  const stripped = rawUrl.replace(/^\/EMSCar(?=\/|$)/, '') || '/';
  const relPath = stripped === '/' ? '/index.html' : stripped.endsWith('/') ? `${stripped}index.html` : stripped;
  const safePath = path.normalize(path.join(siteDir, relPath));

  if (!safePath.startsWith(siteDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
    const ext = path.extname(safePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(safePath).pipe(res);
    return;
  }

  const notFoundPath = path.join(siteDir, '404.html');
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.existsSync(notFoundPath) ? fs.readFileSync(notFoundPath) : 'Not Found');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[GitHub Pages Preview] Serving ./site on http://0.0.0.0:${port} (and /EMSCar/)`);
});
