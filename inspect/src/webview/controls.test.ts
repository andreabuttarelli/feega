import { describe, expect, it } from 'vitest';
import { LiveProp } from '@feega/live-edit/live-fields';
import { CSS_ROWS, ROWS, Control, Section, limitsSet, shownRows, type NumberRow } from './controls';
import { Unit } from './units';

const row = (name: string) => ROWS.find((r) => r.name === name)!;

describe('css rows', () => {
  it('cover the extended properties', () => {
    const names = ['position', 'top', 'z-index', 'display', 'overflow-x', 'overflow-y', 'min-width', 'max-height', 'aspect-ratio', 'object-fit', 'object-position', 'grid-template-columns', 'grid-template-rows', 'grid-column', 'flex-grow', 'flex-shrink', 'flex-basis', 'align-self', 'order', 'border-left-width', 'border-style', 'border-color', 'outline-width', 'outline-style', 'outline-color', 'mix-blend-mode', 'blur', 'backdrop-blur', 'translate', 'rotate', 'scale', 'transition-property', 'transition-duration', 'transition-timing-function', 'cursor', 'text-transform', 'text-decoration-line', 'text-overflow', 'white-space', 'line-clamp', 'word-break', 'list-style-type'];
    expect(names.filter((n) => !ROWS.some((r) => r.name === n))).toEqual([]);
  });

  it('write the standard utility where an exact one exists', () => {
    expect(row('cursor').change('grab').value).toBe('cursor-grab');
    expect(row('min-width').change('240px').value).toBe('min-w-[240px]');
  });

  it('min and max sizes sit in the Size section, under width and height', () => {
    const names = ROWS.filter((r) => r.section === Section.Size).map((r) => r.name);
    expect(names).toEqual(['width', 'height', 'min-width', 'max-width', 'min-height', 'max-height']);
    expect(ROWS.filter((r) => r.section === Section.Constraints).map((r) => r.name)).toEqual(['aspect-ratio']);
  });

  it.each([
    ['min-width', '240px', 'min-w-[240px]', { minWidth: '240px' }],
    ['max-width', '65ch', 'max-w-prose', { maxWidth: '65ch' }],
    ['max-width', 'none', 'max-w-none', { maxWidth: 'none' }],
    ['min-height', '100dvh', 'min-h-dvh', { minHeight: '100dvh' }],
    ['max-height', '50vh', 'max-h-[50vh]', { maxHeight: '50vh' }]
  ])('%s writes %s as %s', (name, value, token, preview) => {
    expect(row(name).change(value)).toEqual({ prop: LiveProp.Class, family: `arbitrary:${name}`, value: token });
    expect(row(name).preview(value)).toEqual(preview);
  });

  it('clearing a limit writes an empty class', () => {
    expect(row('max-width').change('').value).toBe('');
    expect(row('max-width').preview('')).toEqual({ maxWidth: '' });
  });

  it('width and height write the keyword utilities', () => {
    expect(row('width').change('100%').value).toBe('w-full');
    expect(row('width').change('fit-content').value).toBe('w-fit');
    expect(row('height').change('auto').value).toBe('h-auto');
    expect(row('width').change('320px').value).toBe('w-[320px]');
  });

  it('a limit is set once the element has any of the four', () => {
    expect(limitsSet({ 'min-width': 'auto', 'max-width': 'none', 'min-height': '0px', 'max-height': 'none' })).toBe(true);
    expect(limitsSet({ 'min-width': 'auto', 'max-width': 'none', 'min-height': 'auto', 'max-height': 'none' })).toBe(false);
    expect(limitsSet({ 'max-width': '720px' })).toBe(true);
    expect(limitsSet({})).toBe(false);
  });

  it('read a limit that is a keyword as no number', () => {
    expect((row('max-width') as NumberRow).read({ 'max-width': 'none' })).toBe(0);
    expect((row('max-width') as NumberRow).read({ 'max-width': '720px' })).toBe(720);
  });

  it('write one arbitrary property per edit, spaces as underscores', () => {
    expect(row('grid-template-columns').change('1fr 2fr')).toEqual({ prop: LiveProp.Class, family: 'arbitrary:grid-template-columns', value: 'grid-cols-[1fr_2fr]' });
    expect(row('transition-duration').change('200').value).toBe('[transition-duration:200ms]');
    expect(row('position').preview('sticky')).toEqual({ position: 'sticky' });
  });

  it('add the unit a bare number field leaves out', () => {
    expect(row('rotate').preview('15')).toEqual({ rotate: '15deg' });
    expect(row('transition-duration').change('200').value).toBe('[transition-duration:200ms]');
    expect(row('blur').preview('4')).toEqual({ filter: 'blur(4px)' });
  });

  it('write a blur as the filter it previews', () => {
    expect(row('blur').change('4')).toEqual({ prop: LiveProp.Class, family: 'arbitrary:filter', value: '[filter:blur(4px)]' });
    expect(row('backdrop-blur').change('6').value).toBe('[backdrop-filter:blur(6px)]');
  });

  it('display swaps the display utility, so it beats an existing flex', () => {
    expect(row('display').change('grid')).toEqual({ prop: LiveProp.Class, family: 'display', value: 'grid' });
    expect(row('display').change('none').value).toBe('hidden');
  });

  it('read a blur back out of the filter', () => {
    const r = row('blur');
    expect(r.control).toBe(Control.Number);
    expect((r as { read: (s: Record<string, string>) => number }).read({ filter: 'blur(6px)' })).toBe(6);
  });

  it('clear the override on an empty value', () => {
    expect(row('cursor').change('').value).toBe('');
    expect(row('cursor').preview('')).toEqual({ cursor: '' });
  });

  it('line clamp writes the Tailwind utility and the boxed preview', () => {
    expect(row('line-clamp').change('2').value).toBe('line-clamp-2');
    expect(Object.keys(row('line-clamp').preview('2'))[0]).toBe('WebkitLineClamp');
  });

  it('every css row reads a property the page reports', () => {
    expect(CSS_ROWS.every((r) => r.reads.length > 0)).toBe(true);
  });
});

describe('position rows', () => {
  const names = (position: string | undefined) => shownRows(ROWS.filter((r) => r.section === 'Position'), position === undefined ? {} : { position }).map((r) => r.name);

  it('a static element shows only the position type', () => {
    expect(names('static')).toEqual(['position']);
    expect(names(undefined)).toEqual(['position']);
  });

  it.each(['relative', 'absolute', 'fixed', 'sticky'])('a %s element shows the offsets and z-index', (position) => {
    expect(names(position)).toEqual(['position', 'top', 'right', 'bottom', 'left', 'z-index']);
  });

  it('offsets take px, % and auto', () => {
    expect((row('top') as NumberRow).units).toEqual([Unit.Px, Unit.Percent, Unit.Auto]);
  });

  it('offsets and z-index write the exact Tailwind utility', () => {
    expect(row('top').change('12px').value).toBe('top-3');
    expect(row('left').change('50%').value).toBe('left-1/2');
    expect(row('z-index').change('10').value).toBe('z-10');
    expect(row('top').change('13px').value).toBe('top-[13px]');
    expect(row('position').change('absolute').value).toBe('absolute');
  });
});
