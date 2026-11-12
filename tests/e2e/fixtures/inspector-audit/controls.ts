import type { Locator, Page } from '@playwright/test';
import { EFFECT_KINDS, EFFECTS, EffectKind, defaultValues, editedParams, isFlag } from '@feega/motion-core/motion/effects/registry';
import { ValueKind } from '@feega/motion-core/motion/keyframes';
import { ADJUSTMENTS } from '@feega/motion-core/motion/fill/adjust';
import { AREAS_NODE, IMPORTED_NODE, KINDS_NODE, Layer, MAINS_NODE, effectId, effectLayer } from './fixture';
import type { Clip, Doc } from './harness';
import { KNOWN } from './known';
import type { Known } from './checks';

export { Check, Severity } from './checks';

export enum Op {
  Type = 'type',
  TypeTab = 'type-tab',
  Arrow = 'arrow',
  ShiftArrow = 'shift-arrow',
  ArrowDown = 'arrow-down',
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
  Styled = 'styled',
  Mixed = 'mixed selection',
  Frame = 'frame selected',
  Instance = 'instance',
  Narrow = 'narrow window'
}

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
  with?: Layer[];
  whole?: (doc: Doc) => unknown;
  mixed?: true;
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

const onNode = (node: string, layer: Layer, state: State, rows: Base[]): Row[] => rows.map((r) => ({ ...r, layer, state, node, id: `${layer}/${r.section}/${r.control}/${r.option}` }));
const on = (layer: Layer, state: State, rows: Base[]): Row[] => onNode(state === State.Imported ? IMPORTED_NODE : KINDS_NODE, layer, state, rows);

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
  { section: 'fill', control: 'Add stop', option: '+', via: swatchVia, target: popover('fill-add-stop'), op: Op.Press, read: (c) => stops(c)?.length, want: grew, canvas: true },
  { section: 'fill', control: 'Gradient stop', option: 'ArrowRight moves stop 1', via: swatchVia, target: (page) => page.getByTestId('side-popover').getByRole('slider', { name: 'Stop 1 of 2', exact: true }), op: Op.Arrow, read: stops, want: changed, canvas: true },
  { section: 'fill', control: 'Stop position', option: 'type 30 + Enter', via: swatchVia, target: (page) => page.getByTestId('side-popover').getByRole('spinbutton', { name: 'Stop position', exact: true }), op: Op.Type, value: 30, read: stops, want: changed, canvas: true },
  { section: 'fill', control: 'Stop colour hex', option: '#00ff00', via: swatchVia, target: popover('colour-channel'), op: Op.Type, value: '00ff00', read: stops, want: changed, canvas: true },
  { section: 'fill', control: 'Remove stop', option: 'press after adding one', via: [...swatchVia, popover('fill-add-stop')], target: (page) => page.getByTestId('side-popover').getByRole('button', { name: 'Remove stop', exact: true }), op: Op.Press, read: (c) => stops(c)?.length, want: changed, canvas: true },
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

const bar = (id: string, nth = 0) => (page: Page) => page.getByTestId('right-bar').getByTestId(id).nth(nth);
const inPopover = (css: string) => (page: Page) => page.getByTestId('side-popover').locator(css).first();
const colourPopover = (page: Page) => page.getByTestId('colour-popover').getByTestId('colour-channel');
const propValue = (key: string) => (c: Clip) => (c.props.propValues as Record<string, unknown> | undefined)?.[key];
const overrides = (c: Clip) => c.props.overrides as Record<string, Record<string, unknown>> | undefined;
const item = (key: string) => (c: Clip) => (c.layoutItem as Record<string, unknown> | undefined)?.[key];
const every = (expected: unknown) => (now: unknown) => Array.isArray(now) && now.every((v) => JSON.stringify(v) === JSON.stringify(expected));
const empty = (now: unknown) => !now || Object.keys(now as object).length === 0;
const fullDoc = (d: Doc) => d;

const instanceRows: Base[] = [
  { section: 'instance', control: 'Text property', option: 'type Team plan + Enter', target: bar('instance-property-text'), op: Op.Type, value: 'Team plan', read: propValue('Title'), want: is('Team plan'), canvas: true },
  { section: 'instance', control: 'Boolean property', option: 'toggle off', target: bar('instance-property-boolean'), op: Op.Press, read: propValue('Show badge'), want: is(false), canvas: true },
  { section: 'instance', control: 'Text override', option: 'type Sale + Enter', target: bar('instance-text', 1), op: Op.Type, value: 'Sale', read: overrides, want: changed, canvas: true },
  { section: 'instance', control: 'Visibility override', option: 'hide an element', target: bar('instance-visible'), op: Op.Press, read: overrides, want: changed, canvas: true },
  { section: 'instance', control: 'Fill override', option: '#22c55e', via: [(page) => page.getByTestId('right-bar').getByTestId('instance-fill').getByRole('button').first()], target: colourPopover, op: Op.Type, value: '22c55e', read: overrides, want: changed, canvas: true },
  { section: 'instance', control: 'Reset fill override', option: 'press', target: bar('instance-reset-fills'), op: Op.Press, read: (c) => overrides(c)?.['card-bg']?.fills, want: gone, canvas: true },
  { section: 'instance', control: 'Variant chip', option: 'Large', target: (page) => page.getByTestId('instance-variant-chips').getByRole('radio', { name: 'Large', exact: true }), op: Op.Press, read: (c) => c.props.comp, want: changed, canvas: false },
  { section: 'instance', control: 'Variant picker', option: 'Large', target: bar('instance-variant'), op: Op.Select, value: 'Large', read: (c) => c.props.comp, want: changed, canvas: false },
  { section: 'instance', control: 'Reset overrides', option: 'press', target: bar('instance-reset'), op: Op.Press, read: overrides, want: empty, canvas: true },
  { section: 'instance', control: 'Detach', option: 'press', target: bar('instance-detach'), op: Op.Press, read: (c) => c.component, want: (now) => now !== 'Precomp', canvas: false }
];

const mainRows: Base[] = [{ section: 'instance', control: 'Add variant', option: 'press', target: bar('instance-add-variant'), op: Op.Press, read: () => null, whole: (d) => Object.keys(d.comps).length, want: grew, canvas: false }];

const FIT_LABELS = ['Fit', 'Stretch', 'Crop', 'Tile'];
const imageRows: Base[] = [
  ...FIT_LABELS.map((fit) => ({ section: 'fill', control: 'Image fit', option: fit, via: swatchVia, target: popover('fill-fit'), op: Op.Select, value: fit, read: fill0('fit'), want: changed, canvas: fit !== 'Crop' })),
  { section: 'fill', control: 'Image focus X', option: 'type 20 + Enter', via: swatchVia, target: popover('fill-focus-x'), op: Op.Type, value: 20, read: fill0('focus'), want: changed, canvas: false },
  { section: 'fill', control: 'Image scale', option: 'type 150 + Enter', via: swatchVia, target: popover('fill-scale'), op: Op.Type, value: 150, read: fill0('scale'), want: changed, canvas: true },
  ...ADJUSTMENTS.map((key) => ({ section: 'fill', control: `Image ${key}`, option: 'type 50 + Enter', via: swatchVia, target: inPopover(`[data-testid="fill-adjust-${key}"] input[type="number"]`), op: Op.Type, value: 50, read: fill0('adjust'), want: changed, canvas: true })),
  { section: 'fill', control: 'Image contrast slider', option: 'drag', via: swatchVia, target: inPopover('[data-testid="fill-adjust-contrast"] input[type="range"]'), op: Op.Drag, read: fill0('adjust'), want: changed, canvas: true }
];

const fxProp = (kind: EffectKind, key: string) => (page: Page) => page.getByTestId('side-popover').locator(`[data-prop="fx.${effectId(kind)}.${key}"]`);
const fxParam = (key: string) => (c: Clip) => (c.effects as { params: Record<string, unknown> }[])[0]?.params[key];

function effectRowsOf(kind: EffectKind): Base[] {
  const open = [testid('effects', 'effect-open')];
  return editedParams(kind, defaultValues(kind)).flatMap((p): Base[] => {
    const base = { section: 'effects', control: `${EFFECTS[kind].label} ${p.label}`, via: open, read: fxParam(p.key), want: changed, canvas: true };
    if (p.kind === ValueKind.Color) {
      return [
        { ...base, option: '#ff0000 in the hex field', target: (page: Page) => fxProp(kind, p.key)(page).getByRole('textbox').first(), op: Op.Type, value: 'ff0000' },
        { ...base, option: '#ff0000 in the picker', via: [...open, (page: Page) => fxProp(kind, p.key)(page).getByRole('button', { name: `Pick ${EFFECTS[kind].label} · ${p.label}` })], target: colourPopover, op: Op.Type, value: 'ff0000' }
      ];
    }
    if (isFlag(kind, p.key)) {
      return [{ ...base, option: 'toggle', target: (page: Page) => fxProp(kind, p.key)(page).getByRole('checkbox'), op: Op.Press }];
    }
    const atTop = Number(p.fallback) >= p.max;
    return [{ ...base, option: atTop ? 'ArrowDown' : 'ArrowUp', target: (page: Page) => fxProp(kind, p.key)(page).getByRole('textbox').first(), op: atTop ? Op.ArrowDown : Op.Arrow }];
  });
}

const fxRows: Row[] = EFFECT_KINDS.flatMap((kind) => onNode(AREAS_NODE, effectLayer(kind) as Layer, State.Single, effectRowsOf(kind)));

const strokeVia = [testid('stroke', 'stroke-row')];
const moreStrokeRows: Base[] = [
  { section: 'stroke', control: 'Stroke paint', option: 'Linear', via: strokeVia, target: popover('stroke-paint'), op: Op.Select, value: 'Linear', read: (c) => (stroke0('paint')(c) as { type?: string } | undefined)?.type, want: changed, canvas: true },
  { section: 'stroke', control: 'Stroke dash pattern', option: 'type 10, 5 + Enter', via: strokeVia, target: popover('stroke-pattern'), op: Op.Type, value: '10, 5', read: stroke0('pattern'), want: changed, canvas: true },
  { section: 'stroke', control: 'Stroke dash gap', option: 'type 4 + Enter', via: strokeVia, target: popover('stroke-gap'), op: Op.Type, value: 4, read: stroke0('gap'), want: changed, canvas: false },
  { section: 'stroke', control: 'Stroke miter limit', option: 'type 8 + Enter', via: strokeVia, target: popover('stroke-miter'), op: Op.Type, value: 8, read: stroke0('miter'), want: changed, canvas: false },
  { section: 'stroke', control: 'Stroke side width', option: 'top 6 + Enter', via: [...strokeVia, popover('stroke-sides')], target: popover('stroke-side-top'), op: Op.Type, value: 6, read: stroke0('sides'), want: changed, canvas: true }
];

const SPOT_NAMES = ['start', 'center', 'end'].flatMap((row) => ['start', 'center', 'end'].map((column) => `Align ${row} ${column}`)).filter((n) => n !== 'Align center start' && n !== 'Align end end');
const moreStackRows: Base[] = [
  { section: 'stack', control: 'Direction', option: 'Wrap', target: named('stack', 'radio', 'Wrap'), op: Op.Press, read: layout('wrap'), want: is(true), canvas: false },
  { section: 'stack', control: 'Direction', option: 'Grid', target: named('stack', 'radio', 'Grid'), op: Op.Press, read: layout('direction'), want: is('grid'), canvas: true },
  { section: 'stack', control: 'Gap mode', option: 'Auto', target: testid('stack', 'auto-layout-gap-mode'), op: Op.Select, value: 'Auto', read: layout('justify'), want: changed, canvas: true },
  { section: 'stack', control: 'Vertical padding', option: 'type 4 + Enter', target: field('stack', 'Vertical padding'), op: Op.Type, value: 4, read: (c) => (layout('padding')(c) as { top: number }).top, want: is(4), canvas: true },
  { section: 'stack', control: 'Top padding', option: 'per side, type 30 + Enter', via: [testid('stack', 'auto-layout-padding-sides')], target: field('stack', 'Top padding'), op: Op.Type, value: 30, read: (c) => (layout('padding')(c) as { top: number }).top, want: is(30), canvas: true },
  { section: 'stack', control: 'Clip content', option: 'toggle', target: testid('stack', 'stack-clip-content'), op: Op.Press, read: (c) => c.clipContent ?? false, want: is(true), canvas: false },
  ...SPOT_NAMES.map((name) => ({ section: 'stack', control: 'Alignment grid', option: name.replace('Align ', ''), target: named('stack', 'button', name), op: Op.Press, read: (c: Clip) => [layout('justify')(c), layout('align')(c)], want: changed, canvas: true }))
];

const moreChildRows: Base[] = [
  { section: 'stack', control: 'Ignore auto layout', option: 'toggle', target: testid('stack', 'auto-layout-absolute'), op: Op.Press, read: item('absolute'), want: is(true), canvas: false },
  { section: 'stack', control: 'Move later', option: 'press', target: named('stack', 'button', 'Move later'), op: Op.Press, read: () => null, whole: (d) => d.tracks.flatMap((t) => t.clips.map((c) => c.id)).join(), want: changed, canvas: true },
  { section: 'stack', control: 'Height sizing', option: 'Fill', via: [testid('stack', 'stack-unit-height')], target: (page) => section('stack')(page).locator('[data-testid="stack-mode-menu-height"] [data-sizing="fill"]'), op: Op.Press, read: item('height'), want: is('fill'), canvas: true },
  { section: 'stack', control: 'Min width', option: 'type 40 + Enter', via: [testid('stack', 'stack-unit-width')], target: testid('stack', 'stack-limit-input-min-width'), op: Op.Type, value: 40, read: item('minWidth'), want: changed, canvas: false },
  { section: 'stack', control: 'Max height', option: 'type 30 + Enter', via: [testid('stack', 'stack-unit-height')], target: testid('stack', 'stack-limit-input-max-height'), op: Op.Type, value: 30, read: item('maxHeight'), want: changed, canvas: true }
];

const adv = [testid('text', 'advanced-type-toggle')];
const advField = (key: string) => (page: Page) => page.getByTestId('advanced-type').locator(`[data-prop="${key}"]`).getByRole('textbox').first();
const advRadio = (key: string, name: string) => (page: Page) => page.getByTestId('advanced-type').locator(`[data-prop="${key}"]`).getByRole('radio', { name, exact: true });
const advText = (nth: number) => (page: Page) => page.getByTestId('advanced-type').locator('input[type="text"]').nth(nth);
const advancedRows: Base[] = [
  { section: 'text', control: 'Other axes', option: "type 'GRAD' 50 + Enter", via: adv, target: advText(0), op: Op.Type, value: "'GRAD' 50", read: prop('axes'), want: changed, canvas: false },
  { section: 'text', control: 'OpenType features', option: "type 'tnum' 1 + Enter", via: adv, target: advText(1), op: Op.Type, value: "'tnum' 1", read: prop('features'), want: changed, canvas: false },
  { section: 'text', control: 'Width axis', option: 'ArrowDown', via: adv, target: advField('stretch'), op: Op.ArrowDown, read: prop('stretch'), want: changed, canvas: false },
  { section: 'text', control: 'Slant axis', option: 'ArrowUp', via: adv, target: advField('slant'), op: Op.Arrow, read: prop('slant'), want: changed, canvas: false },
  { section: 'text', control: 'Paragraph spacing', option: 'type 1 + Enter', via: adv, target: advField('paragraphSpacing'), op: Op.Type, value: 1, read: prop('paragraphSpacing'), want: changed, canvas: false },
  { section: 'text', control: 'Indent', option: 'type 2 + Enter', via: adv, target: advField('paragraphIndent'), op: Op.Type, value: 2, read: prop('paragraphIndent'), want: changed, canvas: true },
  { section: 'text', control: 'Max lines', option: 'type 1 + Enter', via: adv, target: advField('maxLines'), op: Op.Type, value: 1, read: prop('maxLines'), want: changed, canvas: false },
  { section: 'text', control: 'Wrap', option: 'Balance', via: adv, target: advRadio('textWrap', 'Balance'), op: Op.Press, read: prop('textWrap'), want: is('balance'), canvas: false },
  { section: 'text', control: 'Wrap', option: 'No wrap', via: adv, target: advRadio('textWrap', 'No wrap'), op: Op.Press, read: prop('textWrap'), want: changed, canvas: false },
  { section: 'text', control: 'Vertical trim', option: 'Cap to baseline', via: adv, target: advRadio('leadingTrim', 'Cap to baseline'), op: Op.Press, read: prop('leadingTrim'), want: changed, canvas: true },
  { section: 'content', control: 'Truncate text', option: 'Yes', target: named('content', 'radio', 'Yes'), op: Op.Press, read: prop('truncate'), want: is(true), canvas: false }
];

const styleUseRows: Base[] = [
  { section: 'style', control: 'Text style', option: 'Heading', target: anywhere('clip-style'), op: Op.Select, value: 'Heading', read: (c) => c.styleRef, want: is('Heading'), canvas: true }
];
const paintStyleRows: Base[] = [
  { section: 'style', control: 'Colour style', option: 'Brand/Accent', target: anywhere('clip-paint-style'), op: Op.Select, value: 'Brand/Accent', read: whole, want: changed, canvas: true },
  { section: 'style', control: 'Create style', option: 'press', target: anywhere('style-create'), op: Op.Press, read: () => null, whole: (d) => Object.keys((d.styles as object | undefined) ?? {}).length, want: grew, canvas: false }
];
const variableRows: Base[] = [
  { section: 'variables', control: 'Theme mode', option: 'Dark', target: anywhere('layer-mode-Theme'), op: Op.Select, value: 'Dark', read: whole, want: changed, canvas: true },
  { section: 'variables', control: 'Unbind colour', option: 'press', target: anywhere('variable-unbind-color'), op: Op.Press, read: bindOf, want: gone, canvas: false }
];

const frameField = (name: string) => (page: Page) => page.getByTestId('frame-inspector').getByRole('textbox', { name, exact: true }).first();
const frameRows: Base[] = [
  { section: 'frame', control: 'Frame width', option: 'type 1200 + Enter', target: bar('frame-width'), op: Op.Type, value: 1200, read: () => null, whole: (d) => d.width, want: is(1200), canvas: false },
  { section: 'frame', control: 'Frame fill hex', option: '#fef3c7', via: [testid('fill', 'fill-swatch')], target: popover('colour-channel'), op: Op.Type, value: 'fef3c7', read: () => null, whole: fullDoc, want: changed, canvas: true },
  { section: 'frame', control: 'Frame radius', option: 'type 40 + Enter', target: frameField('Roundness'), op: Op.Type, value: 40, read: () => null, whole: fullDoc, want: changed, canvas: true },
  { section: 'frame', control: 'Frame opacity', option: 'type 50 + Enter', target: frameField('Opacity'), op: Op.Type, value: 50, read: () => null, whole: fullDoc, want: changed, canvas: true },
  { section: 'frame', control: 'Clip content', option: 'toggle', target: bar('clip-content'), op: Op.Press, read: () => null, whole: fullDoc, want: changed, canvas: false },
  { section: 'frame', control: 'Add auto layout', option: 'press', target: bar('frame-add-auto-layout'), op: Op.Press, read: () => null, whole: fullDoc, want: changed, canvas: true },
  { section: 'frame', control: 'Add layout grid', option: 'press', target: bar('add-layout-guide'), op: Op.Press, read: () => null, whole: fullDoc, want: changed, canvas: true },
  { section: 'frame', control: 'Add breakpoint', option: 'first preset', via: [(page) => page.getByTestId('frame-settings').locator('summary'), bar('add-breakpoint')], target: (page) => page.getByTestId('right-bar').locator('[data-testid^="breakpoint-preset-"]').first(), op: Op.Press, read: () => null, whole: fullDoc, want: changed, canvas: false }
];

const mixedRows: Base[] = [
  { section: 'constraints', control: 'Horizontal constraint', option: 'Left', target: bar('multi-horizontal'), op: Op.Select, value: 'Left', read: (c) => (c.constraints as Record<string, unknown> | undefined)?.horizontal ?? 'left', want: every('left'), canvas: false, mixed: true },
  { section: 'layer', control: 'Blend mode', option: 'Screen', target: bar('multi-blend'), op: Op.Select, value: 'Screen', read: (c) => c.blend, want: every('screen'), canvas: true, mixed: true },
  { section: 'spacing', control: 'Vertical gap', option: 'type 20 + Enter', target: (page) => page.getByTestId('multi-inspector').getByRole('textbox', { name: 'Vertical gap', exact: true }), op: Op.Type, value: 20, read: prop('y'), want: changed, canvas: true, mixed: true },
  { section: 'layout', control: 'Opacity', option: 'type 50 + Enter', target: (page) => page.getByTestId('multi-inspector').getByRole('textbox', { name: 'Opacity', exact: true }), op: Op.Type, value: 50, read: (c) => (c.transform as Record<string, unknown>).opacity ?? c.props.opacity, want: every(0.5), canvas: true },
  { section: 'layout', control: 'Rotate Z', option: 'type 15 + Enter', target: (page) => page.getByTestId('multi-inspector').getByRole('textbox', { name: 'Rotate Z', exact: true }), op: Op.Type, value: 15, read: (c) => (c.transform as Record<string, unknown>).rotateZ ?? c.props.rotation, want: changed, canvas: true },
  { section: 'box', control: 'Width', option: 'type 400 + Enter', target: (page) => page.getByTestId('multi-inspector').getByRole('textbox', { name: 'Width', exact: true }), op: Op.Type, value: 400, read: prop('width'), want: changed, canvas: true },
  { section: 'style', control: 'Fill rule', option: 'Evenodd', target: (page) => page.getByTestId('multi-inspector').getByRole('combobox', { name: 'Fill rule', exact: true }), op: Op.Select, value: 'Evenodd', read: prop('fillRule'), want: every('evenodd'), canvas: false },
  { section: 'colours', control: 'Selection colour', option: '#22c55e', via: [(page) => page.getByTestId('multi-inspector').getByRole('button', { name: 'Edit #0ea5e9', exact: true })], target: colourPopover, op: Op.Type, value: '22c55e', read: fill0('color'), want: changed, canvas: true }
];
const multiRows: Base[] = mixedRows.map((r) => ({ ...r, with: [Layer.MixB] }));

const LISTED: Row[] = [
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
  ...on(Layer.StackChild, State.Single, sizingRows),
  ...onNode(AREAS_NODE, Layer.CardInstance, State.Instance, instanceRows),
  ...onNode(MAINS_NODE, Layer.Card, State.Instance, mainRows),
  ...onNode(AREAS_NODE, Layer.ImageFill, State.Single, imageRows),
  ...fxRows,
  ...on(Layer.Gradient, State.Single, moreStrokeRows),
  ...on(Layer.Stack, State.Single, moreStackRows),
  ...on(Layer.StackChild, State.Single, moreChildRows),
  ...on(Layer.Text, State.Single, [...advancedRows, ...styleUseRows]),
  ...on(Layer.Rect, State.Single, paintStyleRows),
  ...on(Layer.Bound, State.Bound, variableRows),
  ...onNode(AREAS_NODE, Layer.Frame, State.Frame, frameRows),
  ...onNode(AREAS_NODE, Layer.MixA, State.Mixed, multiRows)
];

export const ROWS: Row[] = LISTED.map((r) => ({ ...r, known: KNOWN[r.id] }));
