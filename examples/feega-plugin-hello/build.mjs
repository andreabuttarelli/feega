import { build } from 'esbuild';

await build({ entryPoints: ['src/plugin.js'], bundle: true, format: 'iife', outfile: 'plugin.js' });
