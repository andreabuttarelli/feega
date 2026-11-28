import { describe, expect, it } from 'vitest';
import { PropKind } from './component-props.ts';
import { ADAPTERS, MountFramework, adapterOf, seededProps } from './mount-adapters.ts';

describe('adapterOf', () => {
  it('picks the adapter by the file the component lives in', () => {
    expect(adapterOf('src/Card.vue')).toBe(ADAPTERS[MountFramework.Vue]);
    expect(adapterOf('src/lib/Card.svelte')).toBe(ADAPTERS[MountFramework.Svelte]);
    expect(adapterOf('src/Card.tsx')).toBe(ADAPTERS[MountFramework.React]);
    expect(adapterOf('src/components/Card.astro')).toBe(ADAPTERS[MountFramework.Astro]);
  });

  it('describes no props for an Astro component that reads none', () => {
    expect(ADAPTERS[MountFramework.Astro].controls('---\n---\n<p />', 'Card.astro', 'Card', '/')).toBeNull();
  });

  it('seeds the props of every component from its declared types, since it has none on the page', () => {
    expect(Object.values(ADAPTERS).map((adapter) => adapter.seedsProps)).toEqual([true, true, true, true]);
  });

  it('reads the Props of an Astro component', () => {
    const code = '---\ninterface Props { title: string }\nconst { title } = Astro.props;\n---\n<h1>{title}</h1>';

    expect(ADAPTERS[MountFramework.Astro].controls(code, 'Card.astro', 'Card', '/')).toEqual([{ name: 'title', kind: PropKind.Text, required: true }]);
  });
});

describe('seededProps', () => {
  const controls = [
    { name: 'name', kind: PropKind.Text, required: true },
    { name: 'size', kind: PropKind.Select, required: false, options: ['sm', 'lg'] },
    { name: 'big', kind: PropKind.Toggle, required: false },
    { name: 'count', kind: PropKind.Number, required: false, default: 3 },
    { name: 'kids', kind: PropKind.Children, required: false }
  ];

  it('fills what the page could not tell with a value of the right kind', () => {
    expect(seededProps(controls, {})).toEqual({ name: 'name', size: 'sm', big: false, count: 3, kids: { $text: 'Text' } });
  });

  it('seeds every kind with a value the component can render', () => {
    const kinds = [
      { name: 'list', kind: PropKind.Array, required: false },
      { name: 'bag', kind: PropKind.Object, required: false },
      { name: 'onPick', kind: PropKind.Callback, required: false },
      { name: 'tint', kind: PropKind.Color, required: false },
      { name: 'when', kind: PropKind.Date, required: false }
    ];

    expect(seededProps(kinds, {})).toEqual({ list: [], bag: {}, onPick: { $fn: true }, tint: '#808080', when: { $date: '2026-01-01T00:00:00.000Z' } });
  });

  it('keeps what the page already has', () => {
    expect(seededProps(controls, { name: 'Starter', count: 9 })).toMatchObject({ name: 'Starter', count: 9 });
  });

  it('leaves the props alone when there are no controls', () => {
    expect(seededProps(null, { a: 1 })).toEqual({ a: 1 });
  });
});
