import { createServer, loadConfigFromFile } from 'vite';
import { feegaSource } from './vite.js';

const [port, host] = process.argv.slice(2);
const FEEGA_SERVER_HEADERS = { 'x-feega-server': 'launcher' };
const SERVE = { command: 'serve', mode: 'development' };

const loaded = await loadConfigFromFile(SERVE, undefined, process.cwd());

const server = await createServer({
  configFile: loaded?.path ?? false,
  plugins: [feegaSource()],
  server: { headers: FEEGA_SERVER_HEADERS, port: Number(port), host, strictPort: true }
});

await server.listen();
server.printUrls();
