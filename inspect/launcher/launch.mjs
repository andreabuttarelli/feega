import { createServer, loadConfigFromFile } from 'vite';
import { feegaSource } from './vite.js';

const [port, host] = process.argv.slice(2);
const FEEGA_SERVER_HEADERS = { 'x-feega-server': 'launcher' };
const SERVE = { command: 'serve', mode: 'development' };

const loaded = await loadConfigFromFile(SERVE, undefined, process.cwd());
const config = loaded?.config ?? {};

const server = await createServer({
  ...config,
  configFile: false,
  root: config.root ?? process.cwd(),
  plugins: [feegaSource(), ...(config.plugins ?? [])],
  server: { ...config.server, headers: { ...config.server?.headers, ...FEEGA_SERVER_HEADERS }, port: Number(port), host, strictPort: true }
});

await server.listen();
server.printUrls();
