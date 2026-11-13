import { hash } from './core';
import type { Pixels } from '../types';

export type CellState = { reference: number; version: number; previous: number; changedAt: number; shown: boolean; shownAt: number };

export type StepMemory = {
	cells: Map<string, CellState>;
	lastTime: number;
	pan: { x: number; y: number };
	columns: Float32Array | null;
	rows: Float32Array | null;
};

export type Settle = { sensitivity: number; noise: number; time: number; tick: number; fade: number };

const PROFILE_STEP = 4;
const MAX_PAN_STEPS = 12;
const NOISE_FPS = 30;
const RELEASE = 0.6;
const STILL_NOISE_SHARE = 0.3;

export function memoryOf(state: Record<string, unknown> | undefined, time: number): StepMemory | null {
	if (!state) {
		return null;
	}

	const known = state.memory as StepMemory | undefined;
	if (known && time >= known.lastTime) {
		known.lastTime = time;
		return known;
	}

	const fresh: StepMemory = { cells: new Map(), lastTime: time, pan: { x: 0, y: 0 }, columns: null, rows: null };
	state.memory = fresh;
	return fresh;
}

export function noiseHit(id: number, extra: number, settle: Settle): boolean {
	return settle.noise > 0 && hash(id, extra, Math.floor(settle.time * NOISE_FPS)) < settle.noise / NOISE_FPS;
}

export function settleCell(memory: StepMemory | null, key: string, id: number, value: number, settle: Settle): CellState {
	if (!memory) {
		const bucket = Math.floor(value / Math.max(0.01, settle.sensitivity));
		const noise = hash(id, 1, 1) < STILL_NOISE_SHARE ? settle.tick : 0;
		return { reference: value, version: bucket + noise, previous: bucket + noise, changedAt: -Infinity, shown: true, shownAt: -Infinity };
	}

	const cell = memory.cells.get(key);
	if (!cell) {
		const created = { reference: value, version: 0, previous: 0, changedAt: -Infinity, shown: false, shownAt: -Infinity };
		memory.cells.set(key, created);
		return created;
	}

	if (Math.abs(value - cell.reference) > settle.sensitivity || noiseHit(id, 2, settle)) {
		cell.reference = value;
		cell.previous = cell.version;
		cell.version++;
		cell.changedAt = settle.time;
	}

	return cell;
}

export function gate(memory: StepMemory | null, cell: CellState, strength: number, threshold: number, time: number): number {
	if (!memory) {
		return strength >= threshold ? 1 : 0;
	}

	const on = cell.shown ? strength >= threshold * RELEASE : strength >= threshold;
	if (on !== cell.shown) {
		cell.shown = on;
		cell.shownAt = time;
	}

	return on ? 1 : 0;
}

export function fadeOf(changedAt: number, time: number, fade: number): number {
	return fade <= 0 ? 1 : Math.min(1, Math.max(0, (time - changedAt) / fade));
}

function profiles(pixels: Pixels): { columns: Float32Array; rows: Float32Array } {
	const { width, height, data } = pixels;
	const columns = new Float32Array(Math.ceil(width / PROFILE_STEP));
	const rows = new Float32Array(Math.ceil(height / PROFILE_STEP));

	for (let y = 0; y < height; y += PROFILE_STEP) {
		for (let x = 0; x < width; x += PROFILE_STEP) {
			const i = (y * width + x) * 4;
			const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
			columns[x / PROFILE_STEP] += lum;
			rows[y / PROFILE_STEP] += lum;
		}
	}

	return { columns, rows };
}

export function bestShift(previous: Float32Array, current: Float32Array, maxSteps = MAX_PAN_STEPS): number {
	let best = 0;
	let bestCost = Infinity;

	for (let shift = -maxSteps; shift <= maxSteps; shift++) {
		let cost = 0;
		let count = 0;
		for (let i = maxSteps; i < current.length - maxSteps; i++) {
			cost += Math.abs(current[i] - previous[i - shift]);
			count++;
		}
		if (count > 0 && cost / count < bestCost) {
			bestCost = cost / count;
			best = shift;
		}
	}

	return best;
}

export function trackPan(memory: StepMemory | null, pixels: Pixels): { x: number; y: number } {
	if (!memory) {
		return { x: 0, y: 0 };
	}

	const { columns, rows } = profiles(pixels);
	if (memory.columns && memory.rows && memory.columns.length === columns.length && memory.rows.length === rows.length) {
		memory.pan.x += bestShift(memory.columns, columns) * PROFILE_STEP;
		memory.pan.y += bestShift(memory.rows, rows) * PROFILE_STEP;
	}

	memory.columns = columns;
	memory.rows = rows;
	return memory.pan;
}

export function wordFor(words: string[], length: number, id: number, version: number, original: string): string {
	if (version === 0) {
		return original;
	}

	const fitting = words.filter((word) => word.length === length);
	const pool = fitting.length > 0 ? fitting : words.filter((word) => word.length < length);
	if (pool.length === 0) {
		return original;
	}

	return pool[Math.floor(hash(id, version, 17) * pool.length)];
}
