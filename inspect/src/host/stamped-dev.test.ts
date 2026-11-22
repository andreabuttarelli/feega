import { describe, expect, it } from 'vitest';
import { Framework } from '@feega/dev-run/run-plan';
import { stampedDev } from './stamped-dev';

const BRIDGE_DIR = '/app/node_modules/.feega-inspect';
const HOST = '127.0.0.1';
const PLAN = { dev: ['npm', 'run', 'dev', '--', '--port', '4000', '--host', HOST], port: 4000 };

describe('stampedDev', () => {
  it('runs Astro through the launcher so its templates carry the source stamp', () => {
    expect(stampedDev(Framework.Astro, PLAN, BRIDGE_DIR, HOST)).toEqual(['node', '/app/node_modules/.feega-inspect/astro.mjs', '4000', HOST]);
  });

  it('extends Nuxt with the stamping layer and keeps the project script', () => {
    expect(stampedDev(Framework.Nuxt, PLAN, BRIDGE_DIR, HOST)).toEqual([...PLAN.dev, '--extends', '/app/node_modules/.feega-inspect/nuxt-layer']);
  });

  it('leaves the other frameworks on their own command', () => {
    expect(stampedDev(Framework.Gatsby, PLAN, BRIDGE_DIR, HOST)).toBeNull();
  });
});
