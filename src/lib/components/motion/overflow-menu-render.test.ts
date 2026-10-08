import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import OverflowMenu from './OverflowMenu.svelte';
import { ACTIONS, menuSections, shortcutOf } from '$lib/motion/actions';
import { Command } from '$lib/motion/shortcuts';

const noop = () => {};
const sections = menuSections().map((s) => ({ ...s, items: s.ids.map((id) => ({ id, run: noop })) }));

describe('overflow menu', () => {
  it('shows one item per action of the ⋯ menu, named from the table', () => {
    const body = render(OverflowMenu, { props: { sections, onclose: noop } }).body;

    for (const id of menuSections().flatMap((s) => s.ids)) {
      const name = ACTIONS[id].name.replaceAll('&', '&amp;');
      expect(body.split(`>${name}</span>`).length - 1, name).toBe(1);
    }
  });

  it('puts the shortcut next to each item', () => {
    const body = render(OverflowMenu, { props: { sections, onclose: noop } }).body;

    expect(body).toMatch(new RegExp(`<kbd[^>]*>${shortcutOf(Command.NudgeBack)}</kbd>`));
  });

  it('draws extra items that are not in the table, like the arrange ops', () => {
    const extra = [{ section: 'Arrange', items: [{ label: 'Align left', run: noop }] }];
    const body = render(OverflowMenu, { props: { sections: extra, onclose: noop } }).body;

    expect(body).toContain('>Align left</span>');
    expect(body).toContain('Arrange');
  });
});
