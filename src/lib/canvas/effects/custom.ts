import type { ShaderParam } from '@feega/shader-fx';
import { CUSTOM, type CustomPass, type CustomStep, type EffectParam, type EffectStep, type Pixels } from './types';

export type CustomEffect = {
	id: string;
	name: string;
	version: number;
	frag: string;
	params: ShaderParam[];
	check: { state: 'unchecked' | 'passed' | 'failed'; problems: string[]; costMs: number | null };
};

export type ParamValues = Record<string, number | string>;

export type ShaderDrawer = (effect: CustomEffect, pixels: Pixels, values: ParamValues) => { pixels: Pixels; compiled: boolean };

export enum CustomStatus {
	Ready = 'ready',
	Failed = 'failed',
	Missing = 'missing'
}

const FAILED_STATE = 'failed';

export function statusOf(effects: CustomEffect[], ref: string): CustomStatus {
	const effect = effects.find((e) => e.id === ref);
	if (!effect) {
		return CustomStatus.Missing;
	}

	return effect.check.state === FAILED_STATE ? CustomStatus.Failed : CustomStatus.Ready;
}

export function customPass(effects: CustomEffect[], drawer: ShaderDrawer): CustomPass {
	const byId = new Map(effects.map((e) => [e.id, e]));
	return (pixels: Pixels, step: CustomStep) => {
		const effect = byId.get(step.ref);
		if (!effect || effect.check.state === FAILED_STATE) {
			return pixels;
		}

		return drawer(effect, pixels, step.params).pixels;
	};
}

const ADAPT: { [K in ShaderParam['kind']]: (p: Extract<ShaderParam, { kind: K }>) => EffectParam } = {
	number: (p) => ({ name: p.key, label: p.label, kind: 'range', min: p.min, max: p.max, step: p.step, default: p.default }),
	color: (p) => ({ name: p.key, label: p.label, kind: 'color', default: p.default }),
	seed: (p) => ({ name: p.key, label: p.label, kind: 'seed', default: p.default })
};

export function customParams(effect: CustomEffect): EffectParam[] {
	return effect.params.map((p) => (ADAPT[p.kind] as (p: ShaderParam) => EffectParam)(p));
}

export function addCustomStep(steps: EffectStep[], effect: CustomEffect): EffectStep[] {
	const params = Object.fromEntries(effect.params.map((p) => [p.key, p.default]));
	return [...steps, { id: CUSTOM, ref: effect.id, params, enabled: true }];
}
