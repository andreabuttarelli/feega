import { describe, expect, it } from 'vitest';
import { LiveProp } from '@feega/live-edit/live-fields';
import { ElementState } from '@feega/live-edit/element-state';
import { Styling } from '../messages';
import { breakpointOf, fileExtOf, identifierOf, webviewDimsOf, linesOf, propCategoryOf, stateOf, targetOf } from './usage-dims';

describe('propCategoryOf', () => {
  it.each([
    [LiveProp.Padding, undefined, 'spacing'],
    [LiveProp.Gap, undefined, 'spacing'],
    [LiveProp.Color, undefined, 'color'],
    [LiveProp.Fill, undefined, 'color'],
    [LiveProp.FontSize, undefined, 'typography'],
    [LiveProp.Radius, undefined, 'border'],
    [LiveProp.Text, undefined, 'text_content'],
    [LiveProp.Class, { width: '10px' }, 'size'],
    [LiveProp.Class, { 'box-shadow': 'none' }, 'effect'],
    [LiveProp.Class, { display: 'flex' }, 'layout'],
    [LiveProp.Class, { 'border-width': '1px' }, 'border'],
    [LiveProp.Class, { 'margin-top': '1px' }, 'spacing'],
    [LiveProp.Class, { 'font-family': 'x' }, 'typography'],
    [LiveProp.Class, { 'background-color': 'red' }, 'color']
  ])('%s %j is %s', (prop, css, expected) => {
    expect(propCategoryOf(prop, css)).toBe(expected);
  });

  it('is undefined when nothing tells the category', () => {
    expect(propCategoryOf(LiveProp.Class, undefined)).toBeUndefined();
  });
});

describe('targetOf', () => {
  it('is text for a text edit', () => {
    expect(targetOf({ prop: LiveProp.Text }, Styling.Tailwind)).toBe('text');
  });

  it('is a tailwind class under tailwind', () => {
    expect(targetOf({ prop: LiveProp.Padding }, Styling.Tailwind)).toBe('tailwind_class');
  });

  it('is scoped css under css', () => {
    expect(targetOf({ prop: LiveProp.Padding }, Styling.Css)).toBe('scoped_css');
  });
});

describe('fileExtOf', () => {
  it.each([
    ['src/app/page.tsx', 'tsx'],
    ['a/b/Card.SVELTE', 'svelte'],
    ['x.astro', 'astro'],
    ['style.css', 'css'],
    ['weird.xyz', 'other'],
    ['Makefile', 'other']
  ])('%s is %s and never carries the path', (path, expected) => {
    expect(fileExtOf(path)).toBe(expected);
  });
});

describe('linesOf', () => {
  it('counts added and removed lines and distinct files, numbers only', () => {
    const out = linesOf([
      { path: 'a.tsx', before: 'a\nb\nc', after: 'a\nB\nc\nd' },
      { path: 'b.css', before: 'x', after: 'x' }
    ]);

    expect(out).toEqual({ lines_added: 2, lines_removed: 1, files_count: 1, paths: ['a.tsx'] });
  });
});

describe('breakpointOf and stateOf', () => {
  it('maps known names, base when absent and custom otherwise', () => {
    expect(breakpointOf('md')).toBe('md');
    expect(breakpointOf(undefined)).toBe('base');
    expect(breakpointOf('tablet-wide')).toBe('custom');
  });

  it('maps element states', () => {
    expect(stateOf(ElementState.Hover)).toBe('hover');
    expect(stateOf(ElementState.FocusVisible)).toBe('focus');
    expect(stateOf(undefined)).toBe('default');
    expect(stateOf('dark')).toBe('dark');
  });
});

describe('identifierOf', () => {
  it('keeps catalog ids and strips what a path would carry', () => {
    expect(identifierOf('hero-split')).toBe('hero-split');
    expect(identifierOf('/Users/me/app/page.tsx')).toBe('Users-me-app-page.tsx');
    expect(identifierOf('???')).toBe('other');
    expect(identifierOf('x'.repeat(100))).toHaveLength(64);
  });
});

describe('webviewDimsOf', () => {
  it('keeps only values the server accepts', () => {
    expect(webviewDimsOf({ state: 'focus-visible', breakpoint: 'lg', variant: 'focus', error_class: 'TypeError', area: 'x' })).toEqual({ state: 'focus', breakpoint: 'lg', variant: 'focus', error_class: 'TypeError', area: 'webview' });
    expect(webviewDimsOf({ breakpoint: 'weird', variant: '/Users/me' })).toEqual({ breakpoint: 'custom' });
    expect(webviewDimsOf(undefined)).toEqual({});
  });

  it('keeps focus mode, control kind and a prop count, and drops anything else', () => {
    expect(webviewDimsOf({ mode: 'mount', control: 'select', prop_count: 3 })).toEqual({ mode: 'mount', control: 'select', prop_count: 3 });
    expect(webviewDimsOf({ mode: 'snapshot' })).toEqual({ mode: 'snapshot' });
    expect(webviewDimsOf({ mode: '/Users/me', control: 'label', prop_count: -1 })).toEqual({});
    expect(webviewDimsOf({ prop_count: 1.5 })).toEqual({});
  });
});
