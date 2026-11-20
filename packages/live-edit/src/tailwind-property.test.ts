import { describe, expect, it } from 'vitest';
import { arbitraryFamily, familyRule } from './live-fields';
import { tailwindToken } from './tailwind-property';

describe('tailwindToken', () => {
  it.each([
    ['cursor', 'grab', 'cursor-grab'],
    ['position', 'absolute', 'absolute'],
    ['overflow-x', 'hidden', 'overflow-x-hidden'],
    ['min-width', '240px', 'min-w-[240px]'],
    ['z-index', '5', 'z-[5]'],
    ['z-index', '10', 'z-10'],
    ['z-index', 'auto', 'z-auto'],
    ['z-index', '-10', '-z-10'],
    ['top', '12px', 'top-3'],
    ['top', '0px', 'top-0'],
    ['top', '0', 'top-0'],
    ['top', '1px', 'top-px'],
    ['top', '13px', 'top-[13px]'],
    ['top', '-8px', '-top-2'],
    ['top', '-9px', '-top-[9px]'],
    ['left', '50%', 'left-1/2'],
    ['right', '100%', 'right-full'],
    ['bottom', 'auto', 'bottom-auto'],
    ['bottom', '2rem', 'bottom-8'],
    ['left', '33%', 'left-[33%]'],
    ['grid-template-columns', '1fr 2fr', 'grid-cols-[1fr_2fr]'],
    ['border-color', '#f00', 'border-[#f00]'],
    ['stroke-width', '2', '[stroke-width:2]']
  ])('%s: %s becomes %s', (property, value, token) => {
    expect(tailwindToken(property, value)).toBe(token);
  });

  it('is empty for an empty value', () => {
    expect(tailwindToken('cursor', '')).toBe('');
  });
});

describe('the family of an arbitrary property', () => {
  const owns = (property: string, token: string) => familyRule(arbitraryFamily(property))!.owns(token, '' as never);

  it.each([
    ['border-color', 'border-slate-200'],
    ['border-color', '[border-color:#f00]'],
    ['cursor', 'cursor-pointer'],
    ['grid-template-columns', 'grid-cols-3'],
    ['min-width', 'min-w-[240px]'],
    ['min-width', '[min-width:240px]']
  ])('%s owns %s', (property, token) => {
    expect(owns(property, token)).toBe(true);
  });

  it.each([
    ['border-color', 'border-2'],
    ['border-color', 'border-[3px]'],
    ['border-color', 'border-solid'],
    ['cursor', 'text-center'],
    ['min-width', 'min-h-4']
  ])('%s leaves %s alone', (property, token) => {
    expect(owns(property, token)).toBe(false);
  });
});
