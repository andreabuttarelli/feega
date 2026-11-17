import { describe, expect, it } from 'bun:test';
import { formatPlan, planInit } from './init.ts';

const vitePkg = JSON.stringify({ name: 'shop', devDependencies: { vite: '^7.0.0', '@vitejs/plugin-react': '^5.0.0' } }, null, 2) + '\n';
const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()]
});
`;

const nextPkg = JSON.stringify({ name: 'site', dependencies: { next: '15.5.29', react: '19.2.0' } }, null, 2) + '\n';
const nextConfig = `import type { NextConfig } from 'next';

const nextConfig: NextConfig = { reactStrictMode: true };

export default nextConfig;
`;

const VITE_DRY_RUN = `Detected vite.

--- vite.config.ts
+ import { feegaSource } from '@feega/source-map/vite';
-   plugins: [react()]
+   plugins: [feegaSource(), react()]

--- package.json
-     "@vitejs/plugin-react": "^5.0.0"
+     "@vitejs/plugin-react": "^5.0.0",
+     "@feega/source-map": "^0.1.0"`;

const NEXT_DRY_RUN = `Detected next.

--- next.config.ts
+ import { withFeegaSource } from '@feega/source-map/next';
- export default nextConfig;
+ export default withFeegaSource(nextConfig);

--- package.json
+   },
+   "devDependencies": {
+     "@feega/source-map": "^0.1.0"`;

describe('planInit', () => {
  it('shows the vite dry-run diff', () => {
    const plan = planInit({ 'package.json': vitePkg, 'vite.config.ts': viteConfig });

    expect(plan.framework).toBe('vite');
    expect(formatPlan(plan)).toBe(VITE_DRY_RUN);
  });

  it('shows the next dry-run diff', () => {
    const plan = planInit({ 'package.json': nextPkg, 'next.config.ts': nextConfig });

    expect(plan.framework).toBe('next');
    expect(formatPlan(plan)).toBe(NEXT_DRY_RUN);
  });

  it('wraps a CommonJS next config', () => {
    const plan = planInit({ 'package.json': nextPkg, 'next.config.js': 'module.exports = {\n  images: {}\n};\n' });

    expect(plan.edits['next.config.js']).toBe(
      "const { withFeegaSource } = require('@feega/source-map/next');\n\nmodule.exports = withFeegaSource({\n  images: {}\n});\n"
    );
  });

  it('adds the vite plugin to empty and multi-line plugin lists', () => {
    const config = (plugins: string) => `export default defineConfig({\n  plugins: ${plugins}\n});\n`;
    const edit = (plugins: string) => planInit({ 'package.json': vitePkg, 'vite.config.ts': config(plugins) }).edits['vite.config.ts'];

    expect(edit('[]')).toContain('plugins: [feegaSource()]');
    expect(edit('[\n    react()\n  ]')).toContain('plugins: [\n    feegaSource(),\n    react()\n  ]');
  });

  it('changes nothing on a project already initialised', () => {
    const first = planInit({ 'package.json': vitePkg, 'vite.config.ts': viteConfig });
    const files = { 'package.json': vitePkg, 'vite.config.ts': viteConfig, ...first.edits };

    expect(planInit(files).edits).toEqual({});
    expect(formatPlan(planInit(files))).toBe('Already set up for vite: nothing to change.');
  });

  it('refuses a project with no supported framework', () => {
    expect(() => planInit({ 'package.json': JSON.stringify({ name: 'x' }) })).toThrow(/vite or next/);
  });

  it('refuses a vite config whose plugins it cannot find', () => {
    expect(() => planInit({ 'package.json': vitePkg, 'vite.config.ts': 'export default {};\n' })).toThrow(/plugins/);
  });
});
