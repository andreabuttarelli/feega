import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ACTIONS, Action, GuideGroup, guideSections, tipText } from './actions';
import { Command } from './shortcuts';

const EDITOR_PAGE = 'src/routes/p/[projectId]/c/[canvasId]/motion/[nodeId]/+page.svelte';
const MOTION_COMPONENTS = 'src/lib/components/motion';

const editorFiles = () => [EDITOR_PAGE, ...readdirSync(MOTION_COMPONENTS).filter((f) => f.endsWith('.svelte')).map((f) => join(MOTION_COMPONENTS, f))];

const BUTTON = /<button\b[^>]*>([\s\S]*?)<\/button>/g;
const COMPONENT_TAG = /<[A-Z]\w*[\s/>]/;
const BLOCK_TAG = /\{[#:/][^}]*\}/g;
const MARKUP = /<[^>]*>/g;

const iconOnly = (inner: string) => COMPONENT_TAG.test(inner) && inner.replace(BLOCK_TAG, '').replace(MARKUP, '').trim() === '';

describe('editor icon buttons', () => {
  it('none is a bare icon: each goes through IconButton, with a name and a tooltip from the table', () => {
    const bare = editorFiles().flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(BUTTON)].filter((m) => iconOnly(m[1])).map((m) => `${file}: ${m[0].slice(0, 90)}`)
    );

    expect(bare).toEqual([]);
  });

  it('every action an IconButton names is in the table', () => {
    const used = editorFiles().flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/action=\{Action\.(\w+)\}/g)].map((m) => m[1]));

    expect(used.length).toBeGreaterThan(0);
    for (const name of used) {
      expect(Object.keys(Action), name).toContain(name);
    }
  });
});

describe('the action table', () => {
  it('declares every keyboard command, each with a name, an icon and a guide group', () => {
    for (const command of Object.values(Command)) {
      const spec = ACTIONS[command];
      expect(spec?.name, command).toBeTruthy();
      expect(spec.icon, command).toBeTruthy();
      expect(Object.values(GuideGroup)).toContain(spec.group);
    }
  });

  it('a tooltip reads name then shortcut, the shortcut from the key table', () => {
    expect(tipText(Command.Split)).toEqual({ name: 'Split clip', keys: '⇧⌘D' });
    expect(tipText(Action.Snap)).toEqual({ name: 'Snap', keys: '' });
    expect(tipText(Command.Delete).keys).toBe('Del ⌫');
  });

  it('the guide lists every command once, in Playback, Edit, Timeline, View', () => {
    const sections = guideSections();
    const rows = sections.flatMap((s) => s.rows);

    expect(sections.map((s) => s.group)).toEqual([GuideGroup.Playback, GuideGroup.Edit, GuideGroup.Timeline, GuideGroup.View]);
    for (const command of Object.values(Command)) {
      expect(rows.filter((r) => r.id === command)).toHaveLength(1);
    }
    expect(rows.find((r) => r.id === Command.ZoomIn)?.gesture).toBe('Pinch the timeline');
  });
});
