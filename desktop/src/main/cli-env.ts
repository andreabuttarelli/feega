import { join } from 'node:path';

const STOP_ON_STDIN_END = 'FEEGA_STOP_ON_STDIN_END';
const ON = '1';
const CACHE_DIR = 'cache';

export type EnvOptions = { editorPort: number; telemetry: boolean; cloud: boolean };

export function cliEnv(base: NodeJS.ProcessEnv, options: EnvOptions, userData: string): NodeJS.ProcessEnv {
  const { FEEGA_CLOUD: _inherited, ...rest } = base;
  return {
    ...rest,
    ELECTRON_RUN_AS_NODE: ON,
    [STOP_ON_STDIN_END]: ON,
    FORCE_COLOR: '0',
    XDG_CACHE_HOME: join(userData, CACHE_DIR),
    ...(options.cloud ? { FEEGA_CLOUD: ON } : {}),
    ...(options.telemetry ? {} : { FEEGA_TELEMETRY: '0' })
  };
}
