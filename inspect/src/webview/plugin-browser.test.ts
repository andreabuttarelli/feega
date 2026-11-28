import { describe, expect, it } from 'vitest';
import { Kind, type Row } from './plugin-manager';
import { Badge, cardsOf, filterCards } from './plugin-browser';

const row = (id: string, name: string, kind = Kind.BuiltIn, enabled = true): Row => ({ id, name, version: '1.0.0', kind, enabled, words: [], badges: [], removable: kind === Kind.Installed });

const cards = cardsOf([row('feega.mesh-gradient', 'Mesh gradient'), row('feega.lucide-icons', 'Lucide icons'), row('feega.shadergradient', 'ShaderGradient'), row('acme.a', 'Acme', Kind.Installed, false)]);
const card = (id: string) => cards.find((one) => one.id === id)!;

describe('cardsOf', () => {
  it('takes the summary from the website registry', () => {
    expect(card('feega.mesh-gradient').summary).toBe('Drag colour points over an element and get a plain CSS mesh gradient.');
  });

  it('calls a plugin Feega made By Feega', () => {
    expect(card('feega.mesh-gradient').labels).toEqual([Badge.ByFeega]);
    expect(card('feega.mesh-gradient').labels).toEqual(['By Feega']);
  });

  it('calls a plugin built on a third-party library Community and Unofficial', () => {
    expect(card('feega.lucide-icons').labels).toEqual([Badge.Community, Badge.Unofficial]);
    expect(card('feega.shadergradient').labels).toEqual(['Community', 'Unofficial']);
  });

  it('calls a plugin outside the registry Community only', () => {
    expect(card('acme.a').labels).toEqual([Badge.Community]);
  });

  it('gives each registry plugin its pixel icon and the others none', () => {
    expect(card('feega.mesh-gradient').icon).toBe('mesh-gradient');
    expect(card('feega.lucide-icons').icon).toBe('lucide');
    expect(card('feega.shadergradient').icon).toBe('shadergradient');
    expect(card('acme.a').icon).toBeUndefined();
  });

  it('credits the library a plugin is built on', () => {
    expect(card('feega.lucide-icons').credit).toBe('Built on Lucide · ISC');
    expect(card('feega.mesh-gradient').credit).toBe('');
    expect(card('acme.a').credit).toBe('');
  });

  it('gives plugins outside the registry no summary', () => {
    expect(card('acme.a').summary).toBe('');
  });

  it('keeps the enabled state and removability of the row', () => {
    expect(card('acme.a').enabled).toBe(false);
    expect(card('acme.a').removable).toBe(true);
    expect(card('feega.mesh-gradient').removable).toBe(false);
  });
});

describe('filterCards', () => {
  it('matches name or summary, ignoring case', () => {
    expect(filterCards(cards, 'MESH').map((one) => one.id)).toEqual(['feega.mesh-gradient']);
    expect(filterCards(cards, 'colour points').map((one) => one.id)).toEqual(['feega.mesh-gradient']);
  });

  it('returns everything for a blank query', () => {
    expect(filterCards(cards, '  ')).toHaveLength(4);
  });
});
