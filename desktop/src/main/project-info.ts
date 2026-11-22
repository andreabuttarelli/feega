import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const UNKNOWN = 'web app';

const FRAMEWORKS: [string, string][] = [
  ['next', 'next'],
  ['nuxt', 'nuxt'],
  ['@sveltejs/kit', 'sveltekit'],
  ['astro', 'astro'],
  ['@remix-run/react', 'remix'],
  ['react-router', 'react router'],
  ['svelte', 'svelte'],
  ['vue', 'vue'],
  ['react', 'react'],
  ['vite', 'vite']
];

export function frameworkOf(dir: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return FRAMEWORKS.find(([dep]) => dep in deps)?.[1] ?? UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}
