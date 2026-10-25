import type { ConnectorType } from './connectors';
import type { NodeType } from './node-data';
import { audioInputPorts, audioOutputPorts, audioOperationOf, type AudioInputKind, type AudioOperationId } from './audio-operations';

export enum InputRule {
  Model = 'model',
  List = 'list',
  Audio = 'audio',
  Technique = 'technique'
}

export enum OutputRule {
  Item = 'item',
  Media = 'media',
  Audio = 'audio',
  Technique = 'technique'
}

type Ports = {
  inputs: InputRule | readonly ConnectorType[];
  output: OutputRule | ConnectorType | null;
};

export type PortContext = {
  modelPorts: () => ConnectorType[];
  listPorts: () => ConnectorType[];
  itemPort: () => ConnectorType;
  mediaKind: () => 'image' | 'video';
  audioOperation?: () => AudioOperationId;
  audioInput?: () => AudioInputKind;
  techniquePorts?: () => { inputs: ConnectorType[]; output: ConnectorType | null };
};

const NONE: readonly ConnectorType[] = [];

export const NODE_PORTS: Record<NodeType, Ports> = {
  text: { inputs: InputRule.Model, output: 'text' },
  image: { inputs: InputRule.Model, output: 'images' },
  video: { inputs: InputRule.Model, output: 'videos' },
  doc: { inputs: NONE, output: 'text' },
  iframe: { inputs: NONE, output: null },
  social_account_feed: { inputs: NONE, output: 'images' },
  social_post_mockup: { inputs: NONE, output: null },
  products: { inputs: NONE, output: 'images' },
  ads: { inputs: NONE, output: null },
  influencer: { inputs: NONE, output: 'images' },
  list: { inputs: InputRule.List, output: OutputRule.Item },
  select: { inputs: ['text', 'images'], output: OutputRule.Item },
  effects: { inputs: ['images', 'videos'], output: OutputRule.Media },
  composition: { inputs: ['images', 'videos', 'motions'], output: 'videos' },
  calendar: { inputs: ['images', 'videos', 'audios', 'text'], output: null },
  audio: { inputs: InputRule.Audio, output: OutputRule.Audio },
  model3d: { inputs: ['images', 'text'], output: null },
  motion: { inputs: NONE, output: 'motions' },
  element: { inputs: NONE, output: null },
  studio_batch: { inputs: NONE, output: 'images' },
  section: { inputs: NONE, output: null },
  technique: { inputs: InputRule.Technique, output: OutputRule.Technique }
};

const DEFAULT_AUDIO_OPERATION_CTX = (): AudioOperationId => audioOperationOf({});
const DEFAULT_AUDIO_INPUT_CTX = (): AudioInputKind => 'text';

const NO_TECHNIQUE_PORTS = { inputs: [] as ConnectorType[], output: null };
const techniquePortsOf = (ctx: PortContext) => (ctx.techniquePorts ?? (() => NO_TECHNIQUE_PORTS))();

const INPUTS: Record<InputRule, (ctx: PortContext) => ConnectorType[]> = {
  [InputRule.Technique]: (ctx) => techniquePortsOf(ctx).inputs,
  [InputRule.Model]: (ctx) => ctx.modelPorts(),
  [InputRule.List]: (ctx) => ctx.listPorts(),
  [InputRule.Audio]: (ctx) => audioInputPorts((ctx.audioOperation ?? DEFAULT_AUDIO_OPERATION_CTX)())
};

const OUTPUTS: Record<OutputRule, (ctx: PortContext) => ConnectorType | null> = {
  [OutputRule.Technique]: (ctx) => techniquePortsOf(ctx).output,
  [OutputRule.Item]: (ctx) => ctx.itemPort(),
  [OutputRule.Media]: (ctx) => (ctx.mediaKind() === 'video' ? 'videos' : 'images'),
  [OutputRule.Audio]: (ctx) =>
    audioOutputPorts((ctx.audioOperation ?? DEFAULT_AUDIO_OPERATION_CTX)(), (ctx.audioInput ?? DEFAULT_AUDIO_INPUT_CTX)())[0]
};

const isRule = <R extends string>(value: unknown, rules: Record<R, unknown>): value is R =>
  typeof value === 'string' && value in rules;

export function portsOf(type: NodeType, ctx: PortContext): { inputs: ConnectorType[]; output: ConnectorType | null } {
  const { inputs, output } = NODE_PORTS[type];
  return {
    inputs: isRule(inputs, INPUTS) ? INPUTS[inputs](ctx) : [...inputs],
    output: isRule(output, OUTPUTS) ? OUTPUTS[output](ctx) : output
  };
}
