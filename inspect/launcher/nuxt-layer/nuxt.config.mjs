import { Bridge, feegaSource } from '../vite.js';

export default { vite: { plugins: [feegaSource({ bridge: Bridge.Proxy, root: process.cwd() })] } };
