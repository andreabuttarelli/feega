import type { PluginApi } from '@feega/plugin-api/client';
import { Control, OpKind, type Selection, type Source, type UiNode } from '@feega/plugin-api/protocol';
import { Kind, PRESETS, kindOf } from './presets';

export const SECTION = 'presets';
export const BAR = 'gradient';
export const ITEM = 'presets';
export const PICK = 'preset';
export const KIND = 'kind';
export const CLEAR = 'clear';
export const LABEL = 'Gradient preset';

const ALL = 'all';
const NO_GRADIENT = 'none';

const KIND_OPTIONS = [
  { value: ALL, label: 'All' },
  { value: Kind.Linear, label: 'Linear' },
  { value: Kind.Radial, label: 'Radial' },
  { value: Kind.Conic, label: 'Conic' }
];

const sourceOf = (at: Source) => `${at.file}:${at.line}:${at.col}`;

export function gradientsPlugin(api: PluginApi) {
  const popover = api.section(SECTION);
  const bar = api.section(BAR);
  let selection: Selection | null = null;
  let opened: Source | null = null;
  let kind = ALL;

  const tree = (): UiNode[] => [
    { type: Control.Select, id: KIND, label: 'Kind', value: kind, options: KIND_OPTIONS },
    {
      type: Control.Grid,
      id: PICK,
      label: 'Gradients',
      selected: null,
      items: PRESETS.filter((preset) => kind === ALL || kindOf(preset) === kind).map((preset) => ({ id: preset.id, label: preset.name, swatch: preset.css }))
    }
  ];

  async function show() {
    await popover.render(opened ? tree() : []);
    await bar.render(selection ? [{ type: Control.Button, id: CLEAR, label: 'Remove gradient' }] : []);
  }

  const apply = (at: Source, css: string) => api.propose(LABEL, [{ kind: OpKind.Style, at: sourceOf(at), css: { 'background-image': css } }]);

  const ACTIONS: Record<string, (value: string | number | boolean) => Promise<void>> = {
    [KIND]: (value) => ((kind = String(value)), show()),
    [PICK]: async (value) => {
      const preset = PRESETS.find((one) => one.id === value);
      const at = opened;
      opened = null;
      await show();
      if (preset && at) {
        await apply(at, preset.css);
      }
    }
  };

  popover.on((id, value) => void ACTIONS[id]?.(value));

  bar.on((id) => {
    if (id === CLEAR && selection) {
      void apply(selection.source, NO_GRADIENT);
    }
  });

  api.menu.on((_, target) => {
    if (target) {
      opened = target;
      void show();
    }
  });

  api.selection.watch((next) => {
    selection = next;
    void show();
  });
}
