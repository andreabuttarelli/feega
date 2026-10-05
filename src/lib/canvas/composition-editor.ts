import type { LayoutParam, LayoutParams } from './composition/types';

export type Control =
	| { kind: 'slider'; min: number; max: number; step: number; value: number }
	| { kind: 'select'; options: { value: string; label: string }[]; value: string }
	| { kind: 'color'; value: string }
	| { kind: 'seed'; value: number };

type ParamOfKind<K extends LayoutParam['kind']> = Extract<LayoutParam, { kind: K }>;

const CONTROLS: { [K in LayoutParam['kind']]: (param: ParamOfKind<K>, value: unknown) => Control } = {
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

export function controlFor(param: LayoutParam, value: unknown): Control {
	const build = CONTROLS[param.kind] as (param: LayoutParam, value: unknown) => Control;
	return build(param, value);
}

export function setLayoutParam(params: LayoutParams, name: string, value: number | string): LayoutParams {
	return { ...params, [name]: value };
}
