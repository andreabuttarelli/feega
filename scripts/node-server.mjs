import { realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

export const OPAQUE_FRAME_ROUTES = ['/motion-libs', '/motion-env'];

const servesOpaqueFrames = (url = '') => OPAQUE_FRAME_ROUTES.some((route) => url.startsWith(`${route}/`));

/** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
export function allowOpaqueFrames(req, res) {
  if (!servesOpaqueFrames(req.url)) {
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
}

/** @param {import('node:http').RequestListener} handler */
export function createNodeServer(handler) {
  return createServer((req, res) => {
    allowOpaqueFrames(req, res);
    handler(req, res);
  });
}

async function serve() {
  const { handler } = await import(new URL('../build/handler.js', import.meta.url).href);
  const server = createNodeServer(handler);
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';

  server.listen(port, host, () => console.log(`Listening on http://${host}:${port}`));
  const stop = () => {
    server.close();
    server.closeAllConnections();
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  await serve();
}
