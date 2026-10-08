import { defineConfig } from 'vite';
import base from './vite-node.config';
import { motionLiveRuntime } from './motion-live-runtime';

export default defineConfig({ ...base, plugins: [motionLiveRuntime()] });
