import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { RenderQueue } from '$lib/motion/server-render';
import { CronMode, cronMode } from '../../../../scripts/dev-crons';

export enum Build {
  Dev = 'dev',
  Production = 'production'
}

const BUILD_QUEUE: Record<Build, (env: Record<string, string | undefined>) => RenderQueue> = {
  [Build.Dev]: (vars) => (cronMode(vars) === CronMode.On ? RenderQueue.Ticking : RenderQueue.Stopped),
  [Build.Production]: () => RenderQueue.Ticking
};

export function renderQueue(build: Build = dev ? Build.Dev : Build.Production, vars: Record<string, string | undefined> = env): RenderQueue {
  return BUILD_QUEUE[build](vars);
}
