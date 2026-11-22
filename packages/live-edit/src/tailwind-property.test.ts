import { describe, expect, it } from 'vitest';
import { arbitraryFamily, familyRule } from './live-fields';
import { tailwindToken } from './tailwind-property';

describe('tailwindToken', () => {
  it.each([
    ['cursor', 'grab', 'cursor-grab'],
    ['position', 'absolute', 'absolute'],
    ['overflow-x', 'hidden', 'overflow-x-hidden'],
    ['min-width', '240px', 'min-w-[240px]'],
    ['min-width', '0', 'min-w-0'],
    ['min-width', '100%', 'min-w-full'],
    ['min-width', 'fit-content', 'min-w-fit'],
    ['min-width', 'min-content', 'min-w-min'],
    ['min-width', 'max-content', 'min-w-max'],
    ['min-width', 'auto', 'min-w-[auto]'],
    ['min-width', '20ch', 'min-w-[20ch]'],
    ['min-width', '50vw', 'min-w-[50vw]'],
    ['max-width', '720px', 'max-w-[720px]'],
    ['max-width', 'none', 'max-w-none'],
    ['max-width', '100%', 'max-w-full'],
    ['max-width', '65ch', 'max-w-prose'],
    ['max-width', '42rem', 'max-w-2xl'],
    ['max-width', '672px', 'max-w-2xl'],
    ['max-width', '640px', 'max-w-screen-sm'],
    ['max-width', '1536px', 'max-w-screen-2xl'],
    ['max-width', '30em', 'max-w-[30em]'],
    ['max-width', 'fit-content', 'max-w-fit'],
    ['min-height', '100vh', 'min-h-screen'],
    ['min-height', '100dvh', 'min-h-dvh'],
    ['min-height', '240px', 'min-h-[240px]'],
    ['max-height', '100%', 'max-h-full'],
    ['max-height', '100vh', 'max-h-screen'],
    ['max-height', '64px', 'max-h-16'],
    ['max-height', '65px', 'max-h-[65px]'],
    ['max-height', 'none', 'max-h-none'],
    ['width', '100%', 'w-full'],
    ['width', 'auto', 'w-auto'],
    ['width', 'fit-content', 'w-fit'],
    ['width', 'min-content', 'w-min'],
    ['width', 'max-content', 'w-max'],
    ['width', '100vw', 'w-screen'],
    ['width', '320px', 'w-[320px]'],
    ['width', '20ch', 'w-[20ch]'],
    ['height', '100dvh', 'h-dvh'],
    ['height', '100vh', 'h-screen'],
    ['height', 'auto', 'h-auto'],
    ['height', '48px', 'h-[48px]'],
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
    ['min-width', '[min-width:240px]'],
    ['max-width', 'max-w-prose'],
    ['max-width', 'max-w-screen-lg'],
    ['max-width', 'max-w-[720px]'],
    ['min-height', 'min-h-screen'],
    ['max-height', 'max-h-[40vh]']
  ])('%s owns %s', (property, token) => {
    expect(owns(property, token)).toBe(true);
  });

  it.each([
    ['border-color', 'border-2'],
    ['border-color', 'border-[3px]'],
    ['border-color', 'border-solid'],
    ['cursor', 'text-center'],
    ['min-width', 'min-h-4'],
    ['max-width', 'w-full'],
    ['max-width', 'max-h-4'],
    ['max-height', 'max-w-prose']
  ])('%s leaves %s alone', (property, token) => {
    expect(owns(property, token)).toBe(false);
  });
});
