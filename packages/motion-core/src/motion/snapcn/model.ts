import { ComponentMode, PropFormat, type CustomComponent, type PropSpec } from '../custom/component';
import { snapcnKit, type SnapcnKit } from './kit';

export enum SnapcnCategory {
  Text = 'text',
  Ai = 'ai-input',
  Logo = 'logos',
  Screen = 'screens',
  Scene = 'scenes',
  Caption = 'captions',
  Cursor = 'cursor',
  Social = 'social',
  Transition = 'transitions',
  Background = 'backgrounds',
  Effect = 'effects',
  Icon = 'icons'
}

export type SnapcnView = { root: HTMLElement; width: number; height: number; fps: number; frames: number; props: Record<string, unknown> };

export type SnapcnRender = (frame: number) => void;

export type SnapcnDraw = (S: SnapcnKit, view: SnapcnView) => SnapcnRender;

export type SnapcnPort = {
  id: string;
  title: string;
  about: string;
  category: SnapcnCategory;
  width: number;
  height: number;
  fps: 24 | 30 | 60;
  frames: number;
  background: string;
  fonts: readonly string[];
  props: Record<string, PropSpec>;
  draw: SnapcnDraw;
  extend?: SnapcnExtend;
};

export type SnapcnExtend = (S: SnapcnKit) => Record<string, unknown>;

export type SnapcnBody = Pick<SnapcnPort, 'draw' | 'frames' | 'width' | 'height' | 'extend'>;

export type SnapcnShape = SnapcnBody & Pick<SnapcnPort, 'props' | 'background'>;

export const SNAPCN_NAME_PREFIX = 'Snapcn';

export const componentName = (id: string) => `${SNAPCN_NAME_PREFIX}${id.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase())}`;

export function snapcnSource(port: SnapcnBody): string {
  return [
    `const S = (${snapcnKit.toString()})();`,
    ...(port.extend ? [`Object.assign(S, (${port.extend.toString()})(S));`] : []),
    'const P = Object.fromEntries(Object.entries(props).map(([key, value]) => [key, value ?? ""]));',
    'root.style.background = String(P.background);',
    `const render = (${port.draw.toString()})(S, { root, width: root.clientWidth || ${port.width}, height: root.clientHeight || ${port.height}, fps, frames: Math.round(duration * fps) || ${port.frames}, props: P });`,
    'render(0);',
    "tl.to({}, { duration, ease: 'none', onUpdate() { render(Math.round(this.time() * fps)); } }, 0);"
  ].join('\n');
}

export const propsOf = (port: Pick<SnapcnPort, 'props' | 'background'>): Record<string, PropSpec> => ({ ...port.props, background: { type: 'string', title: 'Background', format: PropFormat.Color, default: port.background, group: 'Style' } });

export function snapcnComponent(port: SnapcnShape): CustomComponent {
  return {
    source: { html: '', css: '', js: snapcnSource(port) },
    propsSchema: { type: 'object', properties: propsOf(port) },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
