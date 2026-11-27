import { describe, expect, it } from 'vitest';
import { Kind, type Row } from './plugin-manager';
import { Badge, cardsOf, filterCards } from './plugin-browser';

const row = (id: string, name: string, kind = Kind.BuiltIn, enabled = true): Row => ({ id, name, version: '1.0.0', kind, enabled, words: [], badges: [], removable: kind === Kind.Installed });

const cards = cardsOf([row('feega.mesh-gradient', 'Mesh gradient'), row('feega.shadergradient', 'ShaderGradient (community)'), row('acme.a', 'Acme', Kind.Installed, false)]);
const card = (id: string) => cards.find((one) => one.id === id)!;

describe('cardsOf', () => {
  it('takes the summary and screenshots from the website registry', () => {
    expect(card('feega.mesh-gradient').summary).toBe('Drag colour points over an element and get a plain CSS mesh gradient.');
    expect(card('feega.mesh-gradient').shots[0].src).toBe('https://www.feega.app/img/plugins/mesh-gradient-points.webp');
  });

  it('calls registry plugins official and every other one community', () => {
    expect(card('feega.mesh-gradient').badge).toBe(Badge.Official);
    expect(card('feega.shadergradient').badge).toBe(Badge.Community);
    expect(card('acme.a').badge).toBe(Badge.Community);
  });

  it('gives plugins outside the registry no summary and no screenshots', () => {
    expect(card('acme.a').summary).toBe('');
    expect(card('acme.a').shots).toEqual([]);
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
    expect(filterCards(cards, '  ')).toHaveLength(3);
  });
});
