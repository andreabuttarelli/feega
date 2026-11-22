import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CLOUD_ENV, CLOUD_SETTING, cloudEnabled, cloudPorts } from './cloud-flag';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

describe('Feega Cloud flag', () => {
  it('is off by default', () => {
    expect(cloudEnabled({ setting: undefined, env: {} })).toBe(false);
  });

  it('is on with the setting or with FEEGA_CLOUD=1', () => {
    expect(cloudEnabled({ setting: true, env: {} })).toBe(true);
    expect(cloudEnabled({ setting: undefined, env: { [CLOUD_ENV]: '1' } })).toBe(true);
    expect(cloudEnabled({ setting: false, env: { [CLOUD_ENV]: '0' } })).toBe(false);
  });

  it('flag off: nothing is built, so no relay or API client exists', () => {
    const build = vi.fn(() => ({ share: {} as never, cloud: {} as never }));

    expect(cloudPorts(false, build)).toEqual({});
    expect(build).not.toHaveBeenCalled();
  });

  it('flag on: the share and cloud ports are built', () => {
    const ports = { share: {} as never, cloud: {} as never };

    expect(cloudPorts(true, () => ports)).toBe(ports);
  });

  it('the setting is declared in package.json and off', () => {
    expect(manifest.contributes.configuration.properties[CLOUD_SETTING].default).toBe(false);
  });
});
