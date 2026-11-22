import { Bridge, feegaSource } from '../vite.js';

export default { vite: { plugins: [feegaSource(Bridge.Proxy)] } };
