import { describe, expect, it } from 'vitest';
import { Origin, type Catalog, type ExternalPlugin } from '@feega/plugin-api/external';
import { Permission, type Manifest } from '@feega/plugin-api/manifest';
import { Kind, rowsOf } from './plugin-manager';

const manifest = (id: string): Manifest => ({ id, name: `Name ${id}`, version: '1.0.0', grants: [Permission.EditStyle], hosts: ['api.example.com'], contributions: {} });

const external = (id: string, origin: Origin, enabled = true): ExternalPlugin => ({ id, name: `Name ${id}`, version: '2.0.0', origin, enabled, words: ['Change the styles of elements in your code'], manifest: manifest(id), code: '' });

const catalog = (plugins: ExternalPlugin[], disabled: string[] = []): Catalog => ({ plugins, disabled, problems: [] });

describe('rowsOf', () => {
  const rows = rowsOf([manifest('feega.mesh')], catalog([external('acme.a', Origin.Installed), external('me.dev', Origin.Dev)], ['feega.mesh']));
  const row = (id: string) => rows.find((one) => one.id === id)!;

  it('lists built-ins, installed and dev plugins in that order', () => {
    expect(rows.map((one) => one.kind)).toEqual([Kind.BuiltIn, Kind.Installed, Kind.Dev]);
  });

  it('says what each plugin may do, in words', () => {
    expect(row('feega.mesh').words).toEqual(['Change the styles of elements in your code', 'Send requests to api.example.com']);
  });

  it('marks a switched-off built-in as off', () => {
    expect(row('feega.mesh').enabled).toBe(false);
    expect(row('acme.a').enabled).toBe(true);
  });

  it('flags everything that is not built-in as not reviewed, and dev as dev', () => {
    expect(row('feega.mesh').badges).toEqual([]);
    expect(row('acme.a').badges).toEqual(['Not reviewed']);
    expect(row('me.dev').badges).toEqual(['Dev', 'Not reviewed']);
  });

  it('lets the user remove installed plugins only', () => {
    expect(rows.map((one) => one.removable)).toEqual([false, true, false]);
  });
});
