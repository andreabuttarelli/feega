import { describe, expect, it } from 'vitest';
import { FieldKind } from './component-props';
import { SAMPLES, TargetKind, samplesFor, type Target } from './sample-values';

const ROUTE: Target = { kind: TargetKind.Route };
const prop = (fieldKind: FieldKind, name = 'value'): Target => ({ kind: TargetKind.Prop, fieldKind, name });
const idsOf = (target: Target) => samplesFor(target).map((sample) => sample.id);
const make = (id: string, seed: number) => SAMPLES.find((sample) => sample.id === id)!.make(seed);

describe('make', () => {
  it.each(SAMPLES.map((sample) => sample.id))('%s is the same for the same seed', (id) => {
    expect(make(id, 7)).toBe(make(id, 7));
  });

  it.each(['uuid', 'short-id', 'slug', 'number', 'sentence', 'paragraph', 'name', 'email', 'date', 'url', 'image'])('%s changes with the seed', (id) => {
    const values = new Set([1, 2, 3, 4, 5, 6].map((seed) => make(id, seed)));

    expect(values.size).toBeGreaterThan(1);
  });

  it('uuid has the v4 shape', () => {
    expect(make('uuid', 3)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('short id has 8 url-safe characters', () => {
    expect(make('short-id', 3)).toMatch(/^[A-Za-z0-9_-]{8}$/);
  });

  it('slug is lowercase words joined by hyphens', () => {
    expect(make('slug', 3)).toMatch(/^[a-z]+(-[a-z]+)+$/);
  });

  it('number stays within 1 to 100', () => {
    for (let seed = 0; seed < 50; seed++) {
      const value = Number(make('number', seed));

      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('email uses example.com', () => {
    expect(make('email', 3)).toMatch(/^[a-z.]+@example\.com$/);
  });

  it('date is ISO', () => {
    expect(make('date', 3)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('url and image point at the expected hosts', () => {
    expect(make('url', 3)).toMatch(/^https:\/\/example\.com\/.+/);
    expect(make('image', 3)).toMatch(/^https:\/\/picsum\.photos\/seed\/[^/]+\/800\/600$/);
  });

  it('fixed values', () => {
    expect(make('true', 1)).toBe('true');
    expect(make('false', 1)).toBe('false');
    expect(make('empty', 1)).toBe('');
    expect(make('not-found', 1)).toBe('feega-not-found');
  });
});

describe('samplesFor', () => {
  it('route params get slug, id, uuid, number and not-found', () => {
    expect(idsOf(ROUTE)).toEqual(['uuid', 'short-id', 'slug', 'number', 'not-found']);
  });

  it('not-found is for route params only', () => {
    expect(idsOf(prop(FieldKind.Text))).not.toContain('not-found');
    expect(idsOf(prop(FieldKind.Json))).not.toContain('not-found');
  });

  it('a text prop gets the text values', () => {
    expect(idsOf(prop(FieldKind.Text))).toEqual(['uuid', 'short-id', 'slug', 'sentence', 'paragraph', 'name', 'email', 'date', 'url', 'image', 'empty']);
  });

  it('a number prop gets numbers', () => {
    expect(idsOf(prop(FieldKind.Number))).toEqual(['number']);
  });

  it('a toggle prop gets true and false', () => {
    expect(idsOf(prop(FieldKind.Toggle))).toEqual(['true', 'false']);
  });

  it.each(['src', 'imageUrl', 'href', 'avatar', 'photo'])('a text prop named %s gets url and image values', (name) => {
    expect(idsOf(prop(FieldKind.Text, name))).toEqual(['url', 'image']);
  });

  it('an unknown type gets every prop value', () => {
    expect(idsOf(prop(FieldKind.Json))).toEqual(SAMPLES.filter((sample) => sample.id !== 'not-found').map((sample) => sample.id));
  });
});
