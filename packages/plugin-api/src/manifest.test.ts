import { describe, expect, it } from 'vitest';
import { POINTS, Permission, Point, Where, parseManifest } from './manifest';

const valid = {
  id: 'acme.hello',
  name: 'Hello',
  version: '1.0.0',
  permissions: ['selection', 'edit.style', 'network:api.example.com'],
  contributions: {
    rightBar: [{ id: 'main', title: 'Hello' }],
    addMenu: [{ id: 'thing', title: 'Thing', category: 'Stuff' }],
    contextMenu: [{ id: 'act', title: 'Act', where: 'layers' }],
    sidePanel: [{ id: 'side', title: 'Side', html: '<p>hi</p>' }],
    command: [{ id: 'go', title: 'Go' }],
    topBar: [{ id: 'bar', title: 'Bar' }],
    overlay: [{ id: 'ov' }]
  }
};

describe('parseManifest', () => {
  it('reads a complete manifest', () => {
    const out = parseManifest(valid);
    expect(out.ok).toBe(true);
    if (!out.ok) {
      return;
    }
    expect(out.manifest.id).toBe('acme.hello');
    expect(out.manifest.grants).toEqual([Permission.Selection, Permission.EditStyle]);
    expect(out.manifest.hosts).toEqual(['api.example.com']);
    expect(out.manifest.contributions[Point.ContextMenu]?.[0].where).toBe(Where.Layers);
  });

  it('defaults to no permissions and no contributions', () => {
    const out = parseManifest({ id: 'a', name: 'A', version: '0.1.0' });
    expect(out.ok && out.manifest.grants).toEqual([]);
    expect(out.ok && out.manifest.contributions).toEqual({});
  });

  const refused: [string, unknown, RegExp][] = [
    ['not an object', 'x', /object/],
    ['bad id', { ...valid, id: 'Bad Id' }, /id/],
    ['missing name', { ...valid, name: '' }, /name/],
    ['bad version', { ...valid, version: 'one' }, /version/],
    ['unknown permission', { ...valid, permissions: ['root'] }, /permission/],
    ['network without host', { ...valid, permissions: ['network:'] }, /permission/],
    ['unknown contribution point', { ...valid, contributions: { dock: [] } }, /dock/],
    ['entry without id', { ...valid, contributions: { rightBar: [{ title: 'x' }] } }, /id/],
    ['entry missing a required field', { ...valid, contributions: { rightBar: [{ id: 'a' }] } }, /title/],
    ['duplicate id inside a point', { ...valid, contributions: { command: [{ id: 'a', title: 'A' }, { id: 'a', title: 'B' }] } }, /duplicate/],
    ['context menu with unknown place', { ...valid, contributions: { contextMenu: [{ id: 'a', title: 'A', where: 'sky' }] } }, /where/],
    ['side panel without html', { ...valid, contributions: { sidePanel: [{ id: 'a', title: 'A' }] } }, /html/]
  ];

  it.each(refused)('refuses %s', (_name, input, reason) => {
    const out = parseManifest(input);
    expect(out.ok).toBe(false);
    expect(!out.ok && out.reason).toMatch(reason);
  });
});

describe('POINTS', () => {
  it('declares every contribution point once', () => {
    expect(Object.keys(POINTS).sort()).toEqual(Object.values(Point).sort());
  });
});
