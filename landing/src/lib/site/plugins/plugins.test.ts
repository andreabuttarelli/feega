import { describe, expect, it } from 'vitest';
import { PLUGINS, pluginPath } from './plugins';
import { permissionWords } from './permissions';

describe('permission words', () => {
  it('explains each known permission in plain words', () => {
    expect(permissionWords('selection')).toBe('See which element you have selected');
    expect(permissionWords('edit.dependency')).toBe('Add packages to your package.json');
  });

  it('names the host of a network permission', () => {
    expect(permissionWords('network:cdn.jsdelivr.net')).toBe('Download files from cdn.jsdelivr.net');
  });

  it('never hides an unknown permission', () => {
    expect(permissionWords('teleport')).toBe('Ask for the permission "teleport"');
  });
});

describe('plugins', () => {
  it('lists the built-ins', () => {
    expect(PLUGINS.map((p) => p.id)).toEqual(['mesh-gradient', '3d-object', 'lucide-icons', 'brand-logos', 'gradient-presets', 'phosphor-icons']);
  });

  it('writes each permission in plain words', () => {
    const mesh = PLUGINS.find((p) => p.id === 'mesh-gradient');

    expect(mesh?.permissions).toEqual(['See which element you have selected', 'Change the styles of the selected element']);
  });

  it('asks the 3D plugin for no network access', () => {
    const object = PLUGINS.find((p) => p.id === '3d-object');

    expect(object?.permissions.some((line) => line.startsWith('Download files'))).toBe(false);
  });

  it('builds the detail path from the id', () => {
    expect(pluginPath('3d-object')).toBe('/plugins/3d-object');
  });

});
