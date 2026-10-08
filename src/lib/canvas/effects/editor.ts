import { applyStack, EFFECTS } from './index';
import { customParams, type CustomEffect } from './custom';
import { mosaicSvg } from './shape-mosaic';
import { CUSTOM, type EffectId, type EffectParam, type EffectStep, type Pixels } from './types';

type ParamValue = number | string;

export type Control =
	| { kind: 'slider'; min: number; max: number; step: number; value: number }
	| { kind: 'select'; options: { value: string; label: string }[]; value: string }
	| { kind: 'color'; value: string }
	| { kind: 'seed'; value: number };

type ParamOfKind<K extends EffectParam['kind']> = Extract<EffectParam, { kind: K }>;

const CONTROLS: { [K in EffectParam['kind']]: (param: ParamOfKind<K>, value: unknown) => Control } = {
	range: (param, value) => ({
		kind: 'slider',
		min: param.min,
		max: param.max,
		step: param.step,
		value: typeof value === 'number' ? value : param.default
	}),
	select: (param, value) => ({
		kind: 'select',
		options: param.options,
		value: param.options.some((option) => option.value === value) ? (value as string) : param.default
	}),
	color: (param, value) => ({ kind: 'color', value: typeof value === 'string' ? value : param.default }),
	seed: (param, value) => ({ kind: 'seed', value: typeof value === 'number' ? value : param.default })
};

export function controlFor(param: EffectParam, value: unknown): Control {
	const build = CONTROLS[param.kind] as (param: EffectParam, value: unknown) => Control;
	return build(param, value);
}

const MISSING_LABEL = 'Missing effect';

export function stepLabel(step: EffectStep, customs: CustomEffect[]): string {
	if (step.id !== CUSTOM) {
		return EFFECTS[step.id].label;
	}

	return customs.find((c) => c.id === step.ref)?.name ?? MISSING_LABEL;
}

export function stepParams(step: EffectStep, customs: CustomEffect[]): EffectParam[] {
	if (step.id !== CUSTOM) {
		return EFFECTS[step.id].params;
	}

	const effect = customs.find((c) => c.id === step.ref);
	return effect ? customParams(effect) : [];
}

export type Direction = 'up' | 'down';

const OFFSET: Record<Direction, number> = { up: -1, down: 1 };

export function addStep(steps: EffectStep[], id: EffectId): EffectStep[] {
	const params = Object.fromEntries(EFFECTS[id].params.map((param) => [param.name, param.default]));
	return [...steps, { id, params, enabled: true }];
}

export function moveStep(steps: EffectStep[], index: number, direction: Direction): EffectStep[] {
	const target = index + OFFSET[direction];
	if (target < 0 || target >= steps.length) {
		return steps;
	}

	const moved = [...steps];
	[moved[index], moved[target]] = [moved[target], moved[index]];
	return moved;
}

export function toggleStep(steps: EffectStep[], index: number): EffectStep[] {
	return steps.map((step, i) => (i === index ? { ...step, enabled: !step.enabled } : step));
}

export function removeStep(steps: EffectStep[], index: number): EffectStep[] {
	return steps.filter((_, i) => i !== index);
}

export function setParam(steps: EffectStep[], index: number, name: string, value: ParamValue): EffectStep[] {
	return steps.map((step, i) => (i === index ? { ...step, params: { ...step.params, [name]: value } } : step));
}

export function inputChanged(appliedSourceId: string | null, upstreamId: string | null): boolean {
	return appliedSourceId !== null && upstreamId !== null && appliedSourceId !== upstreamId;
}

export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
	const scale = Math.min(1, max / Math.max(width, height));
	return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

const MOSAIC_ID: EffectId = 'shape-mosaic';

export function exportsSvg(steps: EffectStep[]): boolean {
	return lastMosaic(steps) >= 0;
}

function lastMosaic(steps: EffectStep[]): number {
	const last = steps.findLastIndex((step) => step.enabled && step.id === MOSAIC_ID);
	return steps.slice(last + 1).some((step) => step.enabled) ? -1 : last;
}

export function svgExport(pixels: Pixels, steps: EffectStep[]): string | null {
	const last = lastMosaic(steps);
	if (last < 0) {
		return null;
	}

	return mosaicSvg(applyStack(pixels, steps.slice(0, last)), steps[last].params);
}
