import { describe, expect, it } from 'vitest';
import type { Plugin } from 'vite';
import { feegaSource } from './vite.ts';

const VITE_CLIENT = '/app/node_modules/vite/dist/client/client.mjs';
const BRIDGE_IMPORT = /import "\/@fs.*\/bridge\.js";/;

type Transform = (code: string, id: string, options?: { ssr?: boolean }) => { code: string } | null;

const transformOf = (plugin: Plugin) => (plugin.transform as unknown as Transform).bind({} as never);

describe('feegaSource', () => {
  it('loads the bridge with the Vite client, so a SvelteKit page without index.html answers a click', () => {
    const out = transformOf(feegaSource())('export const hot = 1;', VITE_CLIENT);

    expect(out?.code).toMatch(BRIDGE_IMPORT);
    expect(out?.code).toContain('export const hot = 1;');
  });

  it('keeps the bridge out of the server render', () => {
    expect(transformOf(feegaSource())('export const hot = 1;', VITE_CLIENT, { ssr: true })).toBeNull();
  });

  it('leaves other dependencies untouched', () => {
    expect(transformOf(feegaSource())('export const a = 1;', '/app/node_modules/react/index.js')).toBeNull();
  });
});
