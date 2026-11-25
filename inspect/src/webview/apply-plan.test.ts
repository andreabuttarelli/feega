import { describe, expect, it } from 'vitest';
import { applyAskOf } from './apply-plan';
import { ControlKind, type PropControl } from './prop-controls';
import type { Focus } from './focus';

const focus: Focus = { name: 'Card', source: { file: 'src/Card.tsx', line: 3, col: 5 }, index: 0, usage: { at: { file: 'src/Home.tsx', line: 4, col: 3 }, which: { index: 0, count: 1 } } };

const controls: PropControl[] = [
  { name: 'title', kind: ControlKind.Text, default: 'Hi' },
  { name: 'size', kind: ControlKind.Number },
  { name: 'open', kind: ControlKind.Toggle, default: false },
  { name: 'onClick', kind: ControlKind.Callback },
  { name: 'children', kind: ControlKind.Children },
  { name: 'tags', kind: ControlKind.Array, default: [] }
];

const plan = (values: Record<string, unknown>, touched: string[]) => applyAskOf({ focus, controls, values, touched });

describe('apply plan', () => {
  it('points at the usage of the focused instance', () => {
    expect(plan({ title: 'New' }, ['title'])).toMatchObject({ component: 'src/Card.tsx', usage: 'src/Home.tsx:4:3', which: { index: 0, count: 1 } });
  });

  it('writes only what was edited', () => {
    expect(plan({ title: 'New', size: 3 }, ['title'])?.set).toEqual({ title: 'New' });
  });

  it('removes a prop that went back to its default', () => {
    const ask = plan({ title: 'Hi', open: false }, ['title', 'open']);

    expect(ask?.set).toEqual({});
    expect(ask?.remove).toEqual(['title', 'open']);
  });

  it('removes a prop that was cleared', () => {
    expect(plan({}, ['size'])?.remove).toEqual(['size']);
  });

  it('compares arrays by value', () => {
    expect(plan({ tags: [] }, ['tags'])?.remove).toEqual(['tags']);
    expect(plan({ tags: ['a'] }, ['tags'])?.set).toEqual({ tags: ['a'] });
  });

  it('leaves callbacks and children out and says so', () => {
    const ask = plan({ onClick: { $fn: true }, children: 'x', title: 'New' }, ['onClick', 'children', 'title']);

    expect(ask?.set).toEqual({ title: 'New' });
    expect(ask?.skipped).toEqual(['onClick', 'children']);
  });

  it('is nothing without a usage or without edits', () => {
    expect(applyAskOf({ focus: { ...focus, usage: null }, controls, values: {}, touched: ['title'] })).toBeNull();
    expect(plan({}, [])).toBeNull();
  });
});
