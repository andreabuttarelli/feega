import type { ConnectorType } from './connectors';
import type { SlotValue, TechniqueSlot } from './technique';

export const TECHNIQUE_NODE = 'technique';

export const RUNS_CANVAS = 'Technique runs';

export const RUN_ROW_HEIGHT = 1200;

const CONNECTOR_OF_TYPE: Record<string, ConnectorType> = {
  text: 'text',
  doc: 'text',
  image: 'images',
  video: 'videos',
  audio: 'audios',
  model3d: 'models3d',
  motion: 'motions'
};

const TEXT_SLOT_TYPES = new Set(['text', 'doc']);

export function connectorOfSlot(type: string): ConnectorType {
  return CONNECTOR_OF_TYPE[type] ?? 'text';
}

export function instancePorts(slots: { inputs: TechniqueSlot[]; outputs: TechniqueSlot[] }): { inputs: ConnectorType[]; output: ConnectorType | null } {
  const inputs = [...new Set(slots.inputs.map((s) => connectorOfSlot(s.type)))];
  const [first] = slots.outputs;
  return { inputs, output: first ? connectorOfSlot(first.type) : null };
}

export function instanceInputs(inputs: TechniqueSlot[], texts: string[]): SlotValue[] {
  const textSlots = inputs.filter((s) => TEXT_SLOT_TYPES.has(s.type));
  return textSlots.slice(0, texts.length).map((slot, i) => ({ node: slot.node, value: texts[i] }));
}

export const TECHNIQUE_EDIT_PREFIX = 'Technique: ';

export const editCanvasName = (techniqueName: string) => `${TECHNIQUE_EDIT_PREFIX}${techniqueName}`;

export const nextRunRow = (ys: number[]) => (ys.length ? Math.max(...ys) + RUN_ROW_HEIGHT : 0);
