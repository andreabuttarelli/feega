import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const REGISTRY_FILE = 'plugins.json';
const FEEGA_DIR = '.feega';
const PLUGINS_DIR = 'plugins';
const INDENT = 2;

export type Installed = { version: string; source: string; sha256: string; permissions: string[] };

export type Registry = { installed: Record<string, Installed>; disabled: string[] };

export const pluginsRoot = (home: string = homedir()) => join(home, FEEGA_DIR, PLUGINS_DIR);

export const registryPath = (root: string) => join(root, REGISTRY_FILE);

export function readRegistry(root: string): Registry {
  try {
    const raw = JSON.parse(readFileSync(registryPath(root), 'utf8')) as Partial<Registry>;
    return { installed: raw.installed ?? {}, disabled: raw.disabled ?? [] };
  } catch {
    return { installed: {}, disabled: [] };
  }
}

export function writeRegistry(root: string, registry: Registry) {
  mkdirSync(root, { recursive: true });
  writeFileSync(registryPath(root), `${JSON.stringify(registry, null, INDENT)}\n`);
}

export const enabledIn = (registry: Registry, id: string) => !registry.disabled.includes(id);

export const setEnabled = (registry: Registry, id: string, enabled: boolean): Registry => ({
  ...registry,
  disabled: enabled ? registry.disabled.filter((one) => one !== id) : [...new Set([...registry.disabled, id])]
});
