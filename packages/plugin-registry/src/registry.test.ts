import { describe, expect, it } from 'vitest';
import { COPY, PluginLabel, SOURCES, creditLine, labelsOf, pixelIconOf } from './registry';

describe('creditLine', () => {
  it('names the library and its license', () => {
    expect(creditLine({ name: 'Lucide', url: 'https://lucide.dev', license: 'ISC' })).toBe('Built on Lucide · ISC');
  });

  it('is empty without a credit', () => {
    expect(creditLine(undefined)).toBe('');
  });
});

describe('credits', () => {
  it('credit every plugin that wraps a third-party icon or logo set', () => {
    const credited = SOURCES.filter((source) => source.credit).map((source) => source.id);

    expect(credited).toEqual(['lucide-icons', 'brand-logos', 'phosphor-icons', 'heroicons', 'shadergradient']);
  });
});

describe('labelsOf', () => {
  const source = (id: string) => SOURCES.find((one) => one.id === id);

  it('calls a plugin Feega made By Feega', () => {
    expect(labelsOf(source('mesh-gradient'))).toEqual([PluginLabel.ByFeega]);
    expect(labelsOf(source('3d-object'))).toEqual([PluginLabel.ByFeega]);
    expect(labelsOf(source('gradient-presets'))).toEqual([PluginLabel.ByFeega]);
  });

  it('calls a plugin built on a third-party library Community and Unofficial', () => {
    for (const id of ['lucide-icons', 'brand-logos', 'phosphor-icons', 'heroicons', 'shadergradient']) {
      expect(labelsOf(source(id))).toEqual([PluginLabel.Community, PluginLabel.Unofficial]);
    }
  });

  it('calls a plugin outside the registry Community only', () => {
    expect(labelsOf(undefined)).toEqual([PluginLabel.Community]);
  });
});

describe('pixelIconOf', () => {
  it('has pixel art for the icon of every registry plugin', () => {
    for (const source of SOURCES) {
      expect(pixelIconOf(COPY[source.id].icon), source.id).toBe(COPY[source.id].icon);
    }
  });

  it('gives a plugin without a known icon none so the caller falls back', () => {
    expect(pixelIconOf(undefined)).toBeUndefined();
    expect(pixelIconOf('nope')).toBeUndefined();
  });

  it('gives each built-in a different icon', () => {
    const icons = SOURCES.map((source) => COPY[source.id].icon);

    expect(new Set(icons).size).toBe(icons.length);
  });
});
