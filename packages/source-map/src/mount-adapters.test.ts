import { describe, expect, it } from 'vitest';
import { PropKind } from './component-props.ts';
import { ADAPTERS, MountFramework, adapterOf, seededProps } from './mount-adapters.ts';

describe('adapterOf', () => {
  it('picks the adapter by the file the component lives in', () => {
    expect(adapterOf('src/Card.vue')).toBe(ADAPTERS[MountFramework.Vue]);
    expect(adapterOf('src/lib/Card.svelte')).toBe(ADAPTERS[MountFramework.Svelte]);
    expect(adapterOf('src/Card.tsx')).toBe(ADAPTERS[MountFramework.React]);
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
    expect(seededProps(controls, {})).toEqual({ name: 'name', size: 'sm', big: false, count: 3 });
  });

  it('keeps what the page already has', () => {
    expect(seededProps(controls, { name: 'Starter', count: 9 })).toMatchObject({ name: 'Starter', count: 9 });
  });

  it('leaves the props alone when there are no controls', () => {
    expect(seededProps(null, { a: 1 })).toEqual({ a: 1 });
  });
});
