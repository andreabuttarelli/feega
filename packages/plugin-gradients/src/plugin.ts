import type { PluginApi } from '@feega/plugin-api/client';
import { Control, OpKind, type Selection, type UiNode } from '@feega/plugin-api/protocol';
import { Kind, PRESETS, kindOf } from './presets';

export const SECTION = 'gradients';
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

const sourceOf = (selection: Selection) => `${selection.source.file}:${selection.source.line}:${selection.source.col}`;

export function gradientsPlugin(api: PluginApi) {
  const section = api.section(SECTION);
  let selection: Selection | null = null;
  let kind = ALL;
  let chosen: string | null = null;

  const tree = (): UiNode[] => [
    { type: Control.Select, id: KIND, label: 'Kind', value: kind, options: KIND_OPTIONS },
    {
      type: Control.Grid,
      id: PICK,
      label: 'Gradients',
      selected: chosen,
      items: PRESETS.filter((preset) => kind === ALL || kindOf(preset) === kind).map((preset) => ({ id: preset.id, label: preset.name, swatch: preset.css }))
    },
    { type: Control.Button, id: CLEAR, label: 'Remove gradient' }
  ];

  const show = () => section.render(selection ? tree() : []);

  async function apply(css: string) {
    if (selection) {
      await api.propose(LABEL, [{ kind: OpKind.Style, at: sourceOf(selection), css: { 'background-image': css } }]);
    }
  }

  const ACTIONS: Record<string, (value: string | number | boolean) => Promise<void>> = {
    [KIND]: (value) => ((kind = String(value)), show()),
    [PICK]: async (value) => {
      const preset = PRESETS.find((one) => one.id === value);
      if (!preset) {
        return;
      }
      chosen = preset.id;
      await apply(preset.css);
      await show();
    },
    [CLEAR]: async () => {
      chosen = null;
      await apply(NO_GRADIENT);
      await show();
    }
  };

  section.on((id, value) => void ACTIONS[id]?.(value));

  api.selection.watch((next) => {
    selection = next;
    void show();
  });
}
