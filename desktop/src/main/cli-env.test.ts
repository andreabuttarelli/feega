import { describe, expect, it } from 'vitest';
import { cliEnv } from './cli-env';

const base = { PATH: '/opt/homebrew/bin:/usr/bin', HOME: '/Users/a' } as NodeJS.ProcessEnv;
const options = { editorPort: 0, telemetry: true, cloud: false };

describe('cliEnv', () => {
  it('runs the launcher as node and keeps the merged PATH', () => {
    const env = cliEnv(base, options, '/data');

    expect(env).toMatchObject({ ELECTRON_RUN_AS_NODE: '1', FEEGA_STOP_ON_STDIN_END: '1', PATH: base.PATH });
  });

  it('gives AI adapters a writable cache under the app data', () => {
    expect(cliEnv(base, options, '/data').XDG_CACHE_HOME).toBe('/data/cache');
  });

  it('turns Cloud on only when the setting is on', () => {
    expect(cliEnv(base, options, '/data').FEEGA_CLOUD).toBeUndefined();
    expect(cliEnv(base, { ...options, cloud: true }, '/data').FEEGA_CLOUD).toBe('1');
  });

  it('drops an inherited FEEGA_CLOUD when the setting is off', () => {
    expect(cliEnv({ ...base, FEEGA_CLOUD: '1' }, options, '/data').FEEGA_CLOUD).toBeUndefined();
  });

  it('turns telemetry off when asked', () => {
    expect(cliEnv(base, { ...options, telemetry: false }, '/data').FEEGA_TELEMETRY).toBe('0');
  });
});
