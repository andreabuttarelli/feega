import { defineConfig } from 'vite';
import base from './vite-node.config';
import { motionBundles } from './motion-bundles';

export default defineConfig({ ...base, plugins: [motionBundles()] });
