import type { EffectParam, Pixels } from '../types';
import { numberOf, tick, type Params } from './core';
import { memoryOf, trackPan, type Settle, type StepMemory } from './temporal';

export type Motion = { memory: StepMemory | null; settle: Settle; pan: { x: number; y: number } };

export function motionOf(pixels: Pixels, params: Params, time: number, state: Record<string, unknown> | undefined, rate: number): Motion {
	const memory = memoryOf(state, time);
	const loop = numberOf(params, 'loop', 4);
	const noise = numberOf(params, 'rate', rate);
	const pan = params.follow === 'off' ? { x: 0, y: 0 } : trackPan(memory, pixels);
	return {
		memory,
		pan,
		settle: { sensitivity: numberOf(params, 'sensitivity', 14) / 100, noise, time, tick: tick(time, noise, loop), fade: numberOf(params, 'fade', 0.5) }
	};
}

export const BRAND_ORANGE = '#ff5100';

export function motionParams(rate: number, scroll: number): EffectParam[] {
	return [
		{ name: 'sensitivity', label: 'Change when the picture changes by (%)', kind: 'range', min: 2, max: 60, step: 1, default: 14 },
		{ name: 'fade', label: 'Crossfade (s)', kind: 'range', min: 0, max: 2, step: 0.05, default: 0.5 },
		{ name: 'follow', label: 'Follow camera motion', kind: 'select', options: [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }], default: 'on' },
		{ name: 'rate', label: 'Random changes per second (noise)', kind: 'range', min: 0, max: 4, step: 0.05, default: rate },
		{ name: 'scroll', label: 'Scroll (loops per cycle)', kind: 'range', min: 0, max: 4, step: 1, default: scroll },
		{ name: 'loop', label: 'Loop length (s)', kind: 'range', min: 1, max: 20, step: 0.5, default: 8 },
		{ name: 'seed', label: 'Seed', kind: 'seed', default: 1 }
	];
}

export function textParam(fallback: string): EffectParam {
	return { name: 'text', label: 'Words', kind: 'text', default: fallback, maxLength: 600 };
}
