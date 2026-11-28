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
    expect(PLUGINS.map((p) => p.id)).toEqual(['mesh-gradient', '3d-object', 'lucide-icons', 'brand-logos', 'gradient-presets', 'phosphor-icons', 'heroicons', 'shadergradient']);
  });

  it('writes each permission in plain words', () => {
    const mesh = PLUGINS.find((p) => p.id === 'mesh-gradient');

    expect(mesh?.permissions).toEqual(['See which element you have selected', 'Change the styles of the selected element']);
  });

  it('asks the 3D plugin for no network access', () => {
    const object = PLUGINS.find((p) => p.id === '3d-object');

    expect(object?.permissions.some((line) => line.startsWith('Download files'))).toBe(false);
  });

  it('credits the third-party library a plugin wraps', () => {
    const lucide = PLUGINS.find((p) => p.id === 'lucide-icons');
    const mesh = PLUGINS.find((p) => p.id === 'mesh-gradient');

    expect(lucide?.credit).toEqual({ name: 'Lucide', url: 'https://lucide.dev', license: 'ISC' });
    expect(mesh?.credit).toBeUndefined();
  });

  it('builds the detail path from the id', () => {
    expect(pluginPath('3d-object')).toBe('/plugins/3d-object');
  });


  it('labels the plugins Feega made By Feega and the library ones Community and Unofficial', () => {
    expect(PLUGINS.find((p) => p.id === 'mesh-gradient')?.labels).toEqual(['By Feega']);
    expect(PLUGINS.find((p) => p.id === 'lucide-icons')?.labels).toEqual(['Community', 'Unofficial']);
  });

  it('gives each plugin its own pixel icon', () => {
    expect(new Set(PLUGINS.map((p) => p.icon)).size).toBe(PLUGINS.length);
  });
});
