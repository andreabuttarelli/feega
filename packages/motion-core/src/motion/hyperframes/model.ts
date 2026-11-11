import { ComponentMode, PropFormat, type CustomComponent, type PropSpec } from '../custom/component';
import { snapcnKit, type SnapcnKit } from '../snapcn/kit';
import { hfKit, type HfKit } from './kit';

export enum HfCategory {
  LowerThird = 'lower-thirds',
  Caption = 'captions',
  Text = 'text',
  Title = 'titles',
  Chart = 'charts',
  Card = 'cards',
  Transition = 'transitions',
  Ambient = 'ambient'
}

export enum HfOrigin {
  Block = 'block',
  Component = 'component'
}

export type HfKitFull = SnapcnKit & HfKit;

export type HfView = { root: HTMLElement; width: number; height: number; fps: number; frames: number; props: Record<string, unknown> };

export type HfRender = (frame: number) => void;

export type HfDraw = (S: HfKitFull, view: HfView) => HfRender;

export type HfPort = {
  id: string;
  title: string;
  about: string;
  category: HfCategory;
  origin: HfOrigin;
  source: string;
  width: number;
  height: number;
  fps: 24 | 30 | 60;
  frames: number;
  background: string;
  fonts: readonly string[];
  props: Record<string, PropSpec>;
  draw: HfDraw;
};

export const HF_NAME_PREFIX = 'Hf';

export const componentName = (id: string) => `${HF_NAME_PREFIX}${id.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase())}`;

export function hfSource(port: Pick<HfPort, 'draw' | 'frames' | 'width' | 'height'>): string {
  return [
    `const S = Object.assign((${snapcnKit.toString()})(), (${hfKit.toString()})());`,
    'const P = Object.fromEntries(Object.entries(props).map(([key, value]) => [key, value ?? ""]));',
    'root.style.background = String(P.background);',
    `const render = (${port.draw.toString()})(S, { root, width: root.clientWidth || ${port.width}, height: root.clientHeight || ${port.height}, fps, frames: Math.round(duration * fps) || ${port.frames}, props: P });`,
    'render(0);',
    "tl.to({}, { duration, ease: 'none', onUpdate() { render(Math.round(this.time() * fps)); } }, 0);"
  ].join('\n');
}

export const propsOf = (port: HfPort): Record<string, PropSpec> => ({ ...port.props, background: { type: 'string', title: 'Background', format: PropFormat.Color, default: port.background, group: 'Style' } });

export function hfComponent(port: HfPort): CustomComponent {
  return {
    source: { html: '', css: '', js: hfSource(port) },
    propsSchema: { type: 'object', properties: propsOf(port) },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
