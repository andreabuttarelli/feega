import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AGENT_MAX_DURATION_S } from '../src/lib/server/brand-agent/limits';

const DEEP_MAX_DURATION_S = 1800;

const ROUTES_DIR = 'src/routes';
const ROUTE_CONFIG = /export const config = \{ maxDuration: ([A-Z_0-9]+) \}/;
const NAMED_DURATIONS: Record<string, number> = { AGENT_MAX_DURATION_S, DEEP_MAX_DURATION_S };
const LONG_JOB_ROUTES = ['src/routes/api/v1/projects/[projectId]/motion/[nodeId]/agent/deep/+server.ts', 'src/routes/api/v1/motion/deep/resume/+server.ts'];

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return routeFiles(path);
    }
    return /^\+(page|layout|server)(\.server)?\.ts$/.test(entry.name) ? [path] : [];
  });
}

function adapterMaxDuration(): number | null {
  const match = readFileSync('svelte.config.js', 'utf8').match(/vercelAdapter\(\{[^}]*maxDuration: (\d+)/);
  return match ? Number(match[1]) : null;
}

function declaredDurations(): { path: string; seconds: number }[] {
  return routeFiles(ROUTES_DIR).flatMap((path) => {
    const match = readFileSync(path, 'utf8').match(ROUTE_CONFIG);
    if (!match) {
      return [];
    }
    const seconds = NAMED_DURATIONS[match[1]] ?? Number(match[1]);
    return [{ path, seconds }];
  });
}

describe('one Vercel function for the whole app', () => {
  it('sets maxDuration on the adapter, so routes without a config share it', () => {
    expect(adapterMaxDuration()).not.toBeNull();
  });

  it('keeps every route config equal to the adapter default: each distinct value emits another full function', () => {
    const fallback = adapterMaxDuration();
    const outliers = declaredDurations().filter((route) => route.seconds !== fallback && !LONG_JOB_ROUTES.includes(route.path));
    expect(outliers).toEqual([]);
  });

  it('gives the Deep motion routes one shared 30-minute function, and nothing else', () => {
    const long = declaredDurations().filter((route) => route.seconds === DEEP_MAX_DURATION_S);
    expect(long.map((route) => route.path).sort()).toEqual([...LONG_JOB_ROUTES].sort());
  });
});
