import { describe, expect, it } from 'vitest';
import { Origin, type Catalog, type ExternalPlugin } from '@feega/plugin-api/external';
import { Permission, type Manifest } from '@feega/plugin-api/manifest';
import { BUILT_IN_STAMP, reconcile, wantedOf } from './plugin-sync';

const manifest = (id: string): Manifest => ({ id, name: id, version: '1.0.0', grants: [Permission.Selection], hosts: [], contributions: {} });

const external = (id: string, code = 'a', over: Partial<ExternalPlugin> = {}): ExternalPlugin => ({ id, name: id, version: '1.0.0', origin: Origin.Installed, enabled: true, words: [], manifest: manifest(id), code, ...over });

const catalog = (plugins: ExternalPlugin[], disabled: string[] = []): Catalog => ({ plugins, disabled, problems: [] });

describe('wantedOf', () => {
  it('wants every built-in and every enabled external plugin', () => {
    const wanted = wantedOf([manifest('feega.mesh')], catalog([external('acme.a'), external('acme.b', 'x', { enabled: false })]));
    expect(wanted.map((one) => one.id)).toEqual(['feega.mesh', 'acme.a']);
  });

  it('drops a built-in the user switched off', () => {
    expect(wantedOf([manifest('feega.mesh')], catalog([], ['feega.mesh']))).toEqual([]);
  });

  it('keeps the built-in when an external plugin claims its id', () => {
    const wanted = wantedOf([manifest('feega.mesh')], catalog([external('feega.mesh', 'evil')]));
    expect(wanted).toHaveLength(1);
    expect(wanted[0].stamp).toBe(BUILT_IN_STAMP);
  });
});

describe('reconcile', () => {
  it('loads what is wanted and not loaded', () => {
    const wanted = wantedOf([], catalog([external('acme.a')]));
    expect(reconcile(new Map(), wanted)).toEqual({ unload: [], load: wanted });
  });

  it('unloads what is no longer wanted', () => {
    expect(reconcile(new Map([['acme.a', 'old']]), [])).toEqual({ unload: ['acme.a'], load: [] });
  });

  it('leaves an unchanged plugin alone', () => {
    const wanted = wantedOf([], catalog([external('acme.a')]));
    expect(reconcile(new Map([['acme.a', wanted[0].stamp]]), wanted)).toEqual({ unload: [], load: [] });
  });

  it('reloads a plugin whose code changed on disk', () => {
    const before = wantedOf([], catalog([external('acme.a', 'v1')]));
    const after = wantedOf([], catalog([external('acme.a', 'v2')]));
    expect(reconcile(new Map([['acme.a', before[0].stamp]]), after)).toEqual({ unload: ['acme.a'], load: after });
  });

  it('reloads a plugin whose permissions changed', () => {
    const before = wantedOf([], catalog([external('acme.a')]));
    const after = wantedOf([], catalog([external('acme.a', 'a', { manifest: { ...manifest('acme.a'), grants: [Permission.Selection, Permission.EditStyle] } })]));
    expect(reconcile(new Map([['acme.a', before[0].stamp]]), after).load).toHaveLength(1);
  });
});
