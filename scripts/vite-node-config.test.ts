import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const VITE_NODE_CONFIG = /vite-node --config (\S+)/g;

const scriptConfigs = () => {
  const { scripts } = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
  return [...new Set(Object.values(scripts).flatMap((s) => [...s.matchAll(VITE_NODE_CONFIG)].map((m) => m[1])))];
};

const pluginNames = async (file: string) => {
  const config = (await import(`../${file}`)).default;
  return (config.plugins ?? []).flat().map((p: { name: string }) => p.name);
};

describe('vite-node configs', () => {
  it('ogni config degli script risolve virtual:motion-libs, o import:showcase muore al primo import motion', async () => {
    const configs = scriptConfigs();

    expect(configs.length).toBeGreaterThan(0);
    for (const file of configs) {
      expect(await pluginNames(file), file).toEqual(expect.arrayContaining(['motion-bundles', 'motion-libs']));
    }
  });
});
