import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import Square from '@lucide/svelte/icons/square';
import IconButton from './IconButton.svelte';
import SegmentedControl from './SegmentedControl.svelte';
import Row from './Row.svelte';
import Section from './Section.svelte';
import Field from './Field.svelte';
import PanelHeader from './PanelHeader.svelte';
import Toolbar from './Toolbar.svelte';
import { Fold, Placement, Tone } from './styles';

const svg = createRawSnippet(() => ({ render: () => '<svg></svg>' }));
const body = createRawSnippet(() => ({ render: () => '<p>body</p>' }));
const noop = () => {};

describe('the shell primitives', () => {
  it('an icon button always carries its name, so the tooltip and a screen reader say the same thing', () => {
    const html = render(IconButton, { props: { label: 'Rectangle', shortcut: 'r', pressed: true, children: svg } }).body;
    expect(html).toContain('aria-label="Rectangle"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('type="button"');
  });

  it('the accent tone is the solid accent with readable ink, not the bright selection blue', () => {
    const html = render(IconButton, { props: { label: 'Send', tone: Tone.Accent, children: svg } }).body;
    expect(html).toContain('bg-ui-accent-solid');
    expect(html).toContain('text-ui-on-accent');
  });

  it('a segmented control is one radio group with exactly one checked option', () => {
    const html = render(SegmentedControl, {
      props: { label: 'Mode', value: 'motion', onchange: noop, options: [{ value: 'design', label: 'Design' }, { value: 'motion', label: 'Motion' }, { value: 'grid', label: 'Grid', icon: Square }] }
    }).body;
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Grid"');
  });

  it('a row indents by depth and states its selection', () => {
    const html = render(Row, { props: { label: 'Title', depth: 2, selected: true, meta: '00:02' } }).body;
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('padding-left: 32px');
    expect(html).toContain('00:02');
  });

  it('a section header is a caps label; a foldable one is a button that says whether it is open', () => {
    expect(render(Section, { props: { title: 'Layout', children: body } }).body).toMatch(/<h3[^>]*uppercase[^>]*>Layout<\/h3>/);
    const closed = render(Section, { props: { title: 'Effects', fold: Fold.Closed, children: body } }).body;
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).not.toContain('<p>body</p>');
  });

  it('a field ties its label to the control it names', () => {
    const html = render(Field, { props: { label: 'Width', id: 'w', children: body } }).body;
    expect(html).toContain('for="w"');
    expect(html).toContain('Width');
  });

  it('a panel header is the panel title, and a floating toolbar is a raised surface', () => {
    expect(render(PanelHeader, { props: { title: 'Layers' } }).body).toMatch(/<h2[^>]*font-semibold[^>]*>Layers<\/h2>/);
    const bar = render(Toolbar, { props: { label: 'Draw', placement: Placement.Floating, children: body } }).body;
    expect(bar).toContain('role="toolbar"');
    expect(bar).toContain('shadow-ui-float');
  });
});
