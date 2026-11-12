import type { Locator, Page } from '@playwright/test';
import { IMPORTED_NODE, KINDS_NODE, Layer } from './fixture';
import type { Clip } from './harness';

export enum Op {
  Type = 'type',
  TypeTab = 'type-tab',
  Arrow = 'arrow',
  ShiftArrow = 'shift-arrow',
  Scrub = 'scrub',
  Press = 'press',
  Select = 'select',
  Menu = 'menu',
  Pick = 'pick',
  Drag = 'drag'
}

export enum State {
  Single = 'single',
  Imported = 'imported',
  Bound = 'bound to a variable',
  Styled = 'styled'
}

export enum Check {
  Missing = 'missing',
  Reach = 'reach',
  Name = 'name',
  Size = 'size',
  Commit = 'commit',
  Canvas = 'canvas',
  Undo = 'undo',
  Throws = 'throws'
}

export enum Severity {
  Blocker = 'blocker',
  Major = 'major',
  Minor = 'minor'
}

export type Known = { mouse?: Check[]; keyboard?: Check[]; severity: Severity; why: string; ref: string };

type Find = (page: Page) => Locator;

export type Row = {
  id: string;
  node: string;
  layer: Layer;
  section: string;
  control: string;
  option: string;
  state: State;
  via?: Find[];
  target: Find;
  op: Op;
  value?: string | number;
  read: (clip: Clip) => unknown;
  want: (now: unknown, before: unknown) => boolean;
  canvas: boolean;
  local?: (page: Page) => Promise<unknown>;
  known?: Known;
};

const ins = (page: Page) => page.getByTestId('motion-inspector');
const section = (name: string) => (page: Page) => ins(page).locator(`section[data-section="${name}"]`);
const field = (sec: string, name: string) => (page: Page) => section(sec)(page).getByRole('textbox', { name, exact: true });
const testid = (sec: string, id: string) => (page: Page) => section(sec)(page).getByTestId(id).first();
const popover = (id: string) => (page: Page) => page.getByTestId('side-popover').getByTestId(id).first();
const popoverField = (name: string) => (page: Page) => page.getByTestId('side-popover').getByRole('textbox', { name, exact: true });

const prop = (key: string) => (c: Clip) => c.props[key];
const fill0 = (key: string) => (c: Clip) => (c.props.fills as Record<string, unknown>[] | undefined)?.[0]?.[key];
const fillTypes = (c: Clip) => (c.props.fills as { type: string }[] | undefined)?.map((f) => f.type);
const stroke0 = (key: string) => (c: Clip) => (c.props.strokes as Record<string, unknown>[] | undefined)?.[0]?.[key];
const strokeCount = (c: Clip) => (c.props.strokes as unknown[] | undefined)?.length ?? 0;

const is = (expected: unknown) => (now: unknown) => JSON.stringify(now) === JSON.stringify(expected);
const grew = (now: unknown, before: unknown) => Number(now) > Number(before);
const changed = (now: unknown, before: unknown) => JSON.stringify(now) !== JSON.stringify(before);
const lower = (expected: string) => (now: unknown) => String(now).toLowerCase() === expected;

type Base = Omit<Row, 'id' | 'node' | 'layer' | 'state'>;

const on = (layer: Layer, state: State, rows: Base[]): Row[] =>
  rows.map((r) => ({ ...r, layer, state, node: state === State.Imported ? IMPORTED_NODE : KINDS_NODE, id: `${layer}/${r.section}/${r.control}/${r.option}` }));

const sizeRows = (canvas: boolean): Base[] => [
  { section: 'layout', control: 'W', option: 'type 120 + Enter', target: field('layout', 'Width'), op: Op.Type, value: 120, read: prop('width'), want: changed, canvas },
  { section: 'layout', control: 'W', option: 'ArrowUp', target: field('layout', 'Width'), op: Op.Arrow, read: prop('width'), want: grew, canvas },
  { section: 'layout', control: 'W', option: 'Shift+ArrowUp', target: field('layout', 'Width'), op: Op.ShiftArrow, read: prop('width'), want: grew, canvas },
  { section: 'layout', control: 'H', option: 'type 90 + Tab', target: field('layout', 'Height'), op: Op.TypeTab, value: 90, read: prop('height'), want: changed, canvas },
  { section: 'layout', control: 'X', option: 'type 200 + Enter', target: field('layout', 'X'), op: Op.Type, value: 200, read: prop('x'), want: changed, canvas: false },
  { section: 'layout', control: 'X', option: 'scrub label right', target: field('layout', 'X'), op: Op.Scrub, value: 40, read: prop('x'), want: grew, canvas: false },
  { section: 'layout', control: 'Y', option: 'ArrowUp', target: field('layout', 'Y'), op: Op.Arrow, read: prop('y'), want: grew, canvas: false },
  { section: 'layout', control: 'Rotate', option: 'type 15 + Enter', target: field('layout', 'Rotation'), op: Op.Type, value: 15, read: (c) => (c.transform as Record<string, unknown>).rotateZ ?? c.props.rotation, want: changed, canvas }
];

const appearanceRows = (canvas: boolean): Base[] => [
  { section: 'layer', control: 'Opacity', option: 'type 50 + Enter', target: field('layer', 'Opacity'), op: Op.Type, value: 50, read: (c) => (c.transform as Record<string, unknown>).opacity ?? c.props.opacity, want: changed, canvas },
  { section: 'layer', control: 'Opacity', option: 'ArrowUp from 100 stays 100', target: field('layer', 'Opacity'), op: Op.Arrow, read: (c) => (c.transform as Record<string, unknown>).opacity ?? c.props.opacity, want: (now) => now === undefined || Number(now) <= 1, canvas: false },
  { section: 'layer', control: 'Hide layer', option: 'toggle', target: testid('layer', 'layer-visibility'), op: Op.Press, read: (c) => c.hidden ?? false, want: is(true), canvas },
  { section: 'layer', control: 'Blend mode', option: 'Multiply', target: testid('layer', 'blend-select'), op: Op.Select, value: 'Multiply', read: (c) => c.blend, want: is('multiply'), canvas: false }
];

const radiusRows: Base[] = [
  { section: 'layer', control: 'Radius', option: 'type 24 + Enter', target: field('layer', 'Roundness'), op: Op.Type, value: 24, read: prop('roundness'), want: changed, canvas: true },
  { section: 'layer', control: 'Per-corner radius', option: 'split', target: testid('layer', 'radius-per-corner'), op: Op.Press, read: prop('corners'), want: (now) => Array.isArray(now) && now.length === 4, canvas: false }
];

const fillRows: Base[] = [
  { section: 'fill', control: '+ Add fill', option: 'Solid', target: testid('fill', 'fill-add'), op: Op.Menu, value: 'Solid', read: fillTypes, want: (now) => Array.isArray(now) && now.length === 2, canvas: false },
  { section: 'fill', control: '+ Add fill', option: 'Linear', target: testid('fill', 'fill-add'), op: Op.Menu, value: 'Linear', read: fillTypes, want: (now) => Array.isArray(now) && now.includes('linear-gradient'), canvas: true },
  { section: 'fill', control: 'Fill eye', option: 'hide', target: testid('fill', 'fill-eye'), op: Op.Press, read: fill0('visible'), want: is(false), canvas: true },
  { section: 'fill', control: 'Fill remove', option: '−', target: testid('fill', 'fill-remove'), op: Op.Press, read: fillTypes, want: (now) => !Array.isArray(now) || now.length === 0, canvas: true },
  { section: 'fill', control: 'Fill opacity', option: 'type 40 + Enter', target: testid('fill', 'fill-opacity'), op: Op.Type, value: 40, read: fill0('opacity'), want: is(0.4), canvas: true },
  { section: 'fill', control: 'Fill colour hex', option: '#00ff00', via: [testid('fill', 'fill-swatch')], target: popover('colour-channel'), op: Op.Type, value: '00ff00', read: fill0('color'), want: lower('#00ff00'), canvas: true },
  { section: 'fill', control: 'Fill type', option: 'Radial', via: [testid('fill', 'fill-swatch')], target: popover('fill-type'), op: Op.Select, value: 'Radial', read: fill0('type'), want: is('radial-gradient'), canvas: true },
  { section: 'fill', control: 'Fill blend', option: 'multiply', via: [testid('fill', 'fill-swatch')], target: popover('fill-blend'), op: Op.Select, value: 'multiply', read: fill0('blend'), want: is('multiply'), canvas: false }
];

const strokeRows: Base[] = [
  { section: 'stroke', control: '+ Add stroke', option: 'press', target: testid('stroke', 'stroke-add'), op: Op.Press, read: strokeCount, want: grew, canvas: true }
];

const lineStrokeRows: Base[] = [
  { section: 'stroke', control: 'Stroke width', option: 'type 8 + Enter', target: testid('stroke', 'stroke-width'), op: Op.Type, value: 8, read: stroke0('width'), want: changed, canvas: true },
  { section: 'stroke', control: 'Stroke eye', option: 'hide', target: testid('stroke', 'stroke-eye'), op: Op.Press, read: stroke0('visible'), want: is(false), canvas: true },
  { section: 'stroke', control: 'Stroke remove', option: '−', target: testid('stroke', 'stroke-remove'), op: Op.Press, read: strokeCount, want: is(0), canvas: true },
  { section: 'stroke', control: 'Stroke colour hex', option: '#ff0000', via: [testid('stroke', 'stroke-row')], target: popover('colour-channel'), op: Op.Type, value: 'ff0000', read: (c) => (stroke0('paint')(c) as { color?: string } | undefined)?.color, want: lower('#ff0000'), canvas: true },
  { section: 'stroke', control: 'Stroke position', option: 'Outside', via: [testid('stroke', 'stroke-row')], target: popover('stroke-align'), op: Op.Select, value: 'Outside', read: stroke0('align'), want: is('outside'), canvas: false },
  { section: 'stroke', control: 'Stroke dash length', option: 'type 6 + Enter', via: [testid('stroke', 'stroke-row')], target: popover('stroke-dash'), op: Op.Type, value: 6, read: stroke0('dash'), want: changed, canvas: true },
  { section: 'stroke', control: 'Stroke cap', option: 'round', via: [testid('stroke', 'stroke-row')], target: popover('stroke-cap'), op: Op.Select, value: 'round', read: stroke0('cap'), want: is('round'), canvas: true },
  { section: 'stroke', control: 'Stroke end cap', option: 'arrow', via: [testid('stroke', 'stroke-row')], target: popover('stroke-endCap'), op: Op.Select, value: 'triangle arrow', read: stroke0('endCap'), want: changed, canvas: true },
  { section: 'stroke', control: 'Stroke join', option: 'round', via: [testid('stroke', 'stroke-row')], target: popover('stroke-join'), op: Op.Select, value: 'round', read: stroke0('join'), want: is('round'), canvas: false },
  { section: 'stroke', control: 'Stroke width in editor', option: 'type 3 + Enter', via: [testid('stroke', 'stroke-row')], target: popover('stroke-editor-width'), op: Op.Type, value: 3, read: stroke0('width'), want: changed, canvas: true }
];

const typeRows = (canvas: boolean): Base[] => [
  { section: 'text', control: 'Size', option: 'type 64 + Enter', target: field('text', 'Size'), op: Op.Type, value: 64, read: prop('size'), want: changed, canvas },
  { section: 'text', control: 'Size', option: 'ArrowUp', target: field('text', 'Size'), op: Op.Arrow, read: prop('size'), want: grew, canvas },
  { section: 'text', control: 'Weight', option: 'type 300 + Enter', target: field('text', 'Weight'), op: Op.Type, value: 300, read: prop('weight'), want: is(300), canvas },
  { section: 'text', control: 'Line height', option: 'type 150 + Enter', target: field('text', 'Leading'), op: Op.Type, value: 150, read: prop('leading'), want: changed, canvas },
  { section: 'text', control: 'Letter spacing', option: 'type 5 + Enter', target: field('text', 'Tracking'), op: Op.Type, value: 5, read: prop('tracking'), want: changed, canvas },
  { section: 'text', control: 'Italic', option: 'toggle', target: testid('text', 'text-italic'), op: Op.Press, read: prop('italic'), want: is(true), canvas },
  { section: 'text', control: 'Underline', option: 'toggle', target: testid('text', 'text-underline'), op: Op.Press, read: prop('decoration'), want: is('underline'), canvas },
  { section: 'text', control: 'Strikethrough', option: 'toggle', target: testid('text', 'text-strikethrough'), op: Op.Press, read: prop('decoration'), want: is('strikethrough'), canvas },
  { section: 'text', control: 'Case', option: 'Upper', target: testid('text', 'text-case'), op: Op.Select, value: 'Upper', read: prop('textCase'), want: is('upper'), canvas },
  { section: 'text', control: 'Size presets', option: '48', target: testid('text', 'size-presets'), op: Op.Select, value: '48', read: prop('size'), want: changed, canvas },
  { section: 'text', control: 'Advanced type', option: 'open', target: testid('text', 'advanced-type-toggle'), op: Op.Press, read: prop('size'), want: () => true, canvas: false }
];

const anywhere = (id: string) => (page: Page) => page.getByTestId('right-bar').getByTestId(id).first();
const named = (sec: string, role: 'button' | 'radio', name: string) => (page: Page) => section(sec)(page).getByRole(role, { name, exact: true }).first();
const effect0 = (key: string) => (c: Clip) => (c.effects as { params: Record<string, unknown>; enabled: boolean }[])[0]?.params[key];
const layout = (key: string) => (c: Clip) => (c.autoLayout as Record<string, unknown> | null | undefined)?.[key];
const whole = (c: Clip) => c;
const gone = (now: unknown) => now === undefined || now === null;

const effectRows: Base[] = [
  { section: 'effects', control: '+ Add effect', option: 'Gaussian blur', target: testid('effects', 'add-effect'), op: Op.Menu, value: 'Gaussian blur', read: (c) => (c.effects as unknown[]).length, want: grew, canvas: true },
  { section: 'effects', control: 'Effect eye', option: 'hide', target: testid('effects', 'effect-eye'), op: Op.Press, read: (c) => (c.effects as { enabled: boolean }[])[0]?.enabled, want: is(false), canvas: true },
  { section: 'effects', control: 'Remove effect', option: '−', target: named('effects', 'button', 'Remove Drop shadow'), op: Op.Press, read: (c) => (c.effects as unknown[]).length, want: is(0), canvas: true },
  { section: 'effects', control: 'Drop shadow distance', option: 'type 40 + Enter', via: [testid('effects', 'effect-open')], target: popoverField('Distance'), op: Op.Type, value: 40, read: effect0('distance'), want: changed, canvas: true },
  { section: 'effects', control: 'Drop shadow blur', option: 'ArrowUp', via: [testid('effects', 'effect-open')], target: popoverField('Blur'), op: Op.Arrow, read: effect0('blur'), want: grew, canvas: true },
  { section: 'effects', control: 'Drop shadow opacity', option: 'type 90 + Enter', via: [testid('effects', 'effect-open')], target: popoverField('Drop shadow · Colour opacity'), op: Op.Type, value: 90, read: (c) => (c.effects as { params: unknown }[])[0]?.params, want: changed, canvas: true }
];

const stackRows: Base[] = [
  { section: 'stack', control: 'Direction', option: 'Vertical', target: named('stack', 'radio', 'Vertical'), op: Op.Press, read: layout('direction'), want: is('vertical'), canvas: true },
  { section: 'stack', control: 'Gap', option: 'type 40 + Enter', target: field('stack', 'Gap'), op: Op.Type, value: 40, read: layout('gap'), want: is(40), canvas: true },
  { section: 'stack', control: 'Gap', option: 'ArrowUp', target: field('stack', 'Gap'), op: Op.Arrow, read: layout('gap'), want: grew, canvas: true },
  { section: 'stack', control: 'Horizontal padding', option: 'type 32 + Enter', target: field('stack', 'Horizontal padding'), op: Op.Type, value: 32, read: (c) => (layout('padding')(c) as { left: number }).left, want: is(32), canvas: true },
  { section: 'stack', control: 'Padding per side', option: 'toggle', target: testid('stack', 'auto-layout-padding-sides'), op: Op.Press, read: layout('padding'), want: () => true, canvas: false },
  { section: 'stack', control: 'Alignment grid', option: 'end end', target: named('stack', 'button', 'Align end end'), op: Op.Press, read: (c) => [layout('justify')(c), layout('align')(c)], want: changed, canvas: true },
  { section: 'stack', control: 'Remove stack', option: 'press', target: testid('stack', 'auto-layout-remove'), op: Op.Press, read: (c) => c.autoLayout ?? null, want: gone, canvas: false }
];

const stackChildRows: Base[] = [
  { section: 'stack', control: 'Align self', option: 'End', target: testid('stack', 'stack-align-self'), op: Op.Select, value: 'End', read: (c) => (c.layoutItem as Record<string, unknown>)?.alignSelf, want: changed, canvas: true },
  { section: 'stack', control: 'Take out of the stack', option: 'press', target: testid('stack', 'auto-layout-leave'), op: Op.Press, read: (c) => c.parent, want: changed, canvas: false }
];

const constraintRows: Base[] = [
  { section: 'constraints', control: 'Horizontal constraint', option: 'Right', target: testid('constraints', 'constraint-horizontal'), op: Op.Select, value: 'Right', read: (c) => (c.constraints as Record<string, unknown>)?.horizontal, want: is('right'), canvas: false },
  { section: 'constraints', control: 'Pin bottom', option: 'press', target: named('constraints', 'button', 'Pin bottom'), op: Op.Press, read: (c) => (c.constraints as Record<string, unknown>)?.vertical, want: changed, canvas: false },
  { section: 'align', control: 'Align right', option: 'press', target: named('align', 'button', 'Align right'), op: Op.Press, read: whole, want: changed, canvas: false }
];

const styleRows: Base[] = [
  { section: 'style', control: 'Effect style', option: 'Soft shadow', target: anywhere('clip-effect-style'), op: Op.Select, value: 'Soft shadow', read: (c) => c.effectStyleRef, want: is('Soft shadow'), canvas: true }
];

const bindOf = (c: Clip) => (c.bind as Record<string, unknown> | undefined)?.color;
const paint = (c: Clip) => [c.props.color, c.props.fills, bindOf(c)];
const fontPicker = (page: Page) => section('text')(page).getByTestId('font-picker').getByRole('button').first();
const fontSearch = (page: Page) => page.getByRole('dialog', { name: 'Choose a font' }).getByLabel('Search fonts');

const boundFillRows = (other: string): Base[] => [
  { section: 'fill', control: 'Bound fill detach', option: 'press', target: testid('fill', 'fill-detach'), op: Op.Press, read: bindOf, want: gone, canvas: false },
  { section: 'fill', control: 'Bound fill editor', option: `pick ${other}`, via: [testid('fill', 'fill-swatch')], target: (page) => page.getByTestId(`fill-bound-option-${other}`), op: Op.Press, read: bindOf, want: is(other), canvas: true },
  { section: 'fill', control: 'Bound fill editor', option: 'Detach', via: [testid('fill', 'fill-swatch')], target: popover('fill-bound-detach'), op: Op.Press, read: bindOf, want: gone, canvas: false },
  { section: 'fill', control: '+ Add fill on a bound fill', option: 'Solid', target: testid('fill', 'fill-add'), op: Op.Menu, value: 'Solid', read: paint, want: changed, canvas: false },
  { section: 'fill', control: 'Text colour hex after detach', option: '#ff0000', via: [testid('fill', 'fill-detach'), testid('fill', 'fill-swatch')], target: popover('colour-channel'), op: Op.Type, value: 'ff0000', read: paint, want: changed, canvas: true }
];

const colourRows: Base[] = [
  { section: 'fill', control: 'Text colour hex', option: '#ff0000', via: [testid('fill', 'fill-swatch')], target: popover('colour-channel'), op: Op.Type, value: 'ff0000', read: paint, want: changed, canvas: true },
  { section: 'fill', control: 'Text colour picker', option: 'drag the square', via: [testid('fill', 'fill-swatch')], target: popover('colour-square'), op: Op.Drag, read: paint, want: changed, canvas: true }
];

const textUseRows: Base[] = [
  { section: 'text', control: 'Font family', option: 'search Inter + pick', via: [fontPicker], target: fontSearch, op: Op.Pick, value: 'Inter', read: prop('font'), want: is('Inter'), canvas: true },
  { section: 'text', control: 'Text align', option: 'Align centre', target: named('text', 'radio', 'Align centre'), op: Op.Press, read: prop('align'), want: is('center'), canvas: true },
  { section: 'text', control: 'Text align', option: 'Align right', target: named('text', 'radio', 'Align right'), op: Op.Press, read: prop('align'), want: is('right'), canvas: true }
];

const styleDetachRows: Base[] = [
  { section: 'style', control: 'Text style', option: 'None (detach)', target: anywhere('clip-style'), op: Op.Select, value: 'None', read: (c) => c.styleRef, want: gone, canvas: false }
];

const importedStackRows: Base[] = [
  { section: 'stack', control: 'Direction', option: 'Horizontal', target: named('stack', 'radio', 'Horizontal'), op: Op.Press, read: layout('direction'), want: is('horizontal'), canvas: true },
  { section: 'stack', control: 'Gap', option: 'type 12 + Enter', target: field('stack', 'Gap'), op: Op.Type, value: 12, read: layout('gap'), want: is(12), canvas: true }
];

const swatchVia = [testid('fill', 'fill-swatch')];
const stops = (c: Clip) => (c.props.fills as { stops?: unknown[] }[] | undefined)?.[0]?.stops;

const fillTypeRows: Base[] = ['Linear', 'Angular', 'Diamond', 'Image'].map((type) => ({ section: 'fill', control: 'Fill type', option: type, via: swatchVia, target: popover('fill-type'), op: Op.Select, value: type, read: fill0('type'), want: changed, canvas: true }));

const pickerRows: Base[] = [
  { section: 'fill', control: 'Colour picker hue', option: 'drag', via: swatchVia, target: popover('colour-hue'), op: Op.Drag, read: fill0('color'), want: changed, canvas: true },
  { section: 'fill', control: 'Colour picker square', option: 'drag', via: swatchVia, target: popover('colour-square'), op: Op.Drag, read: fill0('color'), want: changed, canvas: true },
  { section: 'fill', control: 'Colour opacity', option: 'type 50 + Enter', via: swatchVia, target: popover('colour-opacity'), op: Op.Type, value: 50, read: (c) => [fill0('color')(c), fill0('opacity')(c)], want: changed, canvas: true },
  { section: 'fill', control: 'Colour alpha slider', option: 'drag', via: swatchVia, target: popover('colour-alpha'), op: Op.Drag, read: (c) => [fill0('color')(c), fill0('opacity')(c)], want: changed, canvas: true }
];

const gradientRows: Base[] = [
  { section: 'fill', control: 'Gradient angle', option: 'type 45 + Enter', via: swatchVia, target: popover('fill-angle'), op: Op.Type, value: 45, read: fill0('angle'), want: changed, canvas: true },
  { section: 'fill', control: 'Gradient bar', option: 'add a stop', via: swatchVia, target: popover('fill-bar'), op: Op.Press, read: (c) => stops(c)?.length, want: grew, canvas: true },
  { section: 'fill', control: 'Gradient stop', option: 'select stop 2', via: swatchVia, target: (page) => page.getByTestId('side-popover').getByRole('button', { name: 'Stop 2', exact: true }), op: Op.Press, read: stops, want: () => true, canvas: false },
  { section: 'fill', control: 'Stop position', option: 'type 30 + Enter', via: swatchVia, target: (page) => page.getByTestId('side-popover').getByRole('spinbutton', { name: 'Stop position', exact: true }), op: Op.Type, value: 30, read: stops, want: changed, canvas: true },
  { section: 'fill', control: 'Stop colour hex', option: '#00ff00', via: swatchVia, target: popover('colour-channel'), op: Op.Type, value: '00ff00', read: stops, want: changed, canvas: true },
  { section: 'fill', control: 'Remove stop', option: 'press after adding one', via: [...swatchVia, popover('fill-bar')], target: (page) => page.getByTestId('side-popover').getByRole('button', { name: 'Remove stop', exact: true }), op: Op.Press, read: (c) => stops(c)?.length, want: changed, canvas: true },
  { section: 'stroke', control: 'Stroke per side', option: 'toggle', via: [testid('stroke', 'stroke-row')], target: popover('stroke-sides'), op: Op.Press, read: stroke0('sides'), want: changed, canvas: false }
];

const moreEffectRows: Base[] = ['Inner shadow', 'Background blur', 'Glow', 'Directional blur', 'Progressive blur'].map((kind) => ({ section: 'effects', control: '+ Add effect', option: kind, target: testid('effects', 'add-effect'), op: Op.Menu, value: kind, read: (c: Clip) => (c.effects as unknown[]).length, want: grew, canvas: kind !== 'Background blur' }));

const sizingRows: Base[] = [
  { section: 'stack', control: 'Width sizing', option: 'Fill', via: [testid('stack', 'stack-unit-width')], target: (page) => section('stack')(page).locator('[data-testid="stack-mode-menu-width"] [data-sizing="fill"]'), op: Op.Press, read: (c) => (c.layoutItem as Record<string, unknown>)?.width, want: is('fill'), canvas: true },
  { section: 'stack', control: 'Height sizing', option: 'Hug', via: [testid('stack', 'stack-unit-height')], target: (page) => section('stack')(page).locator('[data-testid="stack-mode-menu-height"] [data-sizing="hug"]'), op: Op.Press, read: (c) => (c.layoutItem as Record<string, unknown>)?.height, want: changed, canvas: false }
];

const exportRows = (page: Page) => page.getByTestId('right-bar').getByTestId('export-row');
const exportRowsOf: Base[] = [
  { section: 'export', control: 'Add export setting', option: 'press', target: anywhere('export-add'), op: Op.Press, read: () => null, local: (page) => exportRows(page).count(), want: grew, canvas: false },
  { section: 'export', control: 'Export scale', option: '2x', target: (page) => exportRows(page).first().getByRole('combobox', { name: 'Export scale' }), op: Op.Select, value: '2x', read: () => null, local: (page) => exportRows(page).first().getByRole('combobox', { name: 'Export scale' }).inputValue(), want: is('2'), canvas: false },
  { section: 'export', control: 'Export format', option: 'SVG', target: (page) => exportRows(page).first().getByRole('combobox', { name: 'Export format' }), op: Op.Select, value: 'SVG', read: () => null, local: (page) => exportRows(page).first().getByRole('combobox', { name: 'Export format' }).inputValue(), want: changed, canvas: false }
];

export const ROWS: Row[] = [
  ...on(Layer.Rect, State.Single, [...fillRows, ...strokeRows, ...sizeRows(true), ...appearanceRows(true), ...radiusRows]),
  ...on(Layer.Line, State.Single, lineStrokeRows),
  ...on(Layer.Text, State.Single, [...typeRows(true), ...colourRows, ...textUseRows]),
  ...on(Layer.Bound, State.Bound, [...typeRows(true).slice(0, 3), ...boundFillRows('Theme/Ink'), ...styleDetachRows]),
  ...on(Layer.ImportedText, State.Imported, [...typeRows(true).slice(0, 4), typeRows(true)[9], ...boundFillRows('Stripe/Primary'), ...textUseRows, ...styleDetachRows, ...sizeRows(true).slice(0, 2).map((r) => ({ ...r, section: 'stack', target: field('stack', 'Width') }))]),
  ...on(Layer.ImportedPill, State.Imported, [...fillRows.slice(0, 1), ...radiusRows.slice(0, 1), ...importedStackRows]),
  ...on(Layer.Shadowed, State.Single, effectRows),
  ...on(Layer.Stack, State.Single, stackRows),
  ...on(Layer.StackChild, State.Single, stackChildRows),
  ...on(Layer.Rect, State.Single, [...constraintRows, ...styleRows]),
  ...on(Layer.Rect, State.Single, [...fillTypeRows, ...pickerRows, ...exportRowsOf]),
  ...on(Layer.Gradient, State.Single, gradientRows),
  ...on(Layer.Shadowed, State.Single, moreEffectRows),
  ...on(Layer.StackChild, State.Single, sizingRows)
];
