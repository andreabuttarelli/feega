import { env } from '$env/dynamic/public';
import { KILL_FLAG, killSwitch } from './engine-flag';

type Flags = { isFeatureEnabled?: (flag: string) => boolean | undefined };

export function engineKilled(): boolean {
  const flags = typeof window === 'undefined' ? undefined : (window as unknown as { posthog?: Flags }).posthog;
  return killSwitch(env.PUBLIC_MOTION_ENGINE, flags?.isFeatureEnabled?.(KILL_FLAG) === true);
}
