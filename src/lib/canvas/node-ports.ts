import type { ConnectorType } from './connectors';
import type { NodeType } from './node-data';

export enum InputRule {
  Model = 'model',
  List = 'list'
}

export enum OutputRule {
  Item = 'item',
  Media = 'media'
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
  composition: { inputs: ['images'], output: 'videos' },
  calendar: { inputs: NONE, output: null }
};

const INPUTS: Record<InputRule, (ctx: PortContext) => ConnectorType[]> = {
  [InputRule.Model]: (ctx) => ctx.modelPorts(),
  [InputRule.List]: (ctx) => ctx.listPorts()
};

const OUTPUTS: Record<OutputRule, (ctx: PortContext) => ConnectorType> = {
  [OutputRule.Item]: (ctx) => ctx.itemPort(),
  [OutputRule.Media]: (ctx) => (ctx.mediaKind() === 'video' ? 'videos' : 'images')
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
