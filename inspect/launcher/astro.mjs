import { dev } from 'astro';
import { Bridge, feegaSource } from './vite.js';

const [port, host] = process.argv.slice(2);

await dev({
  root: process.cwd(),
  server: { port: Number(port), host },
  vite: { plugins: [feegaSource({ bridge: Bridge.Proxy, root: process.cwd() })] }
});
