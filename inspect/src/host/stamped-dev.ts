import { join } from 'node:path';
import { Framework } from '@feega/dev-run/run-plan';

type Plan = { dev: string[]; port: number };

type Stamping = (plan: Plan, bridgeDir: string, host: string) => string[];

const ASTRO_LAUNCHER = 'astro.mjs';
const NUXT_LAYER = 'nuxt-layer';

const STAMPING: Partial<Record<Framework, Stamping>> = {
  [Framework.Astro]: (plan, bridgeDir, host) => ['node', join(bridgeDir, ASTRO_LAUNCHER), String(plan.port), host],
  [Framework.Nuxt]: (plan, bridgeDir) => [...plan.dev, '--extends', join(bridgeDir, NUXT_LAYER)]
};

export const stampedDev = (framework: Framework, plan: Plan, bridgeDir: string, host: string): string[] | null => STAMPING[framework]?.(plan, bridgeDir, host) ?? null;
