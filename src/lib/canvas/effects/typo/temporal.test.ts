import { describe, expect, it } from 'vitest';
import { bestShift, fadeOf, gate, memoryOf, settleCell, wordFor } from './temporal';

const SETTLE = { sensitivity: 0.1, noise: 0, time: 0, tick: 0, fade: 0.4 };

describe('typo temporal state', () => {
	it('a cell keeps its word while its content holds still, even over many frames', () => {
		const memory = memoryOf({}, 0)!;
		for (let frame = 0; frame < 60; frame++) {
			settleCell(memory, 'a', 1, 0.5 + (frame % 2) * 0.05, { ...SETTLE, time: frame / 30 });
		}
		expect(memory.cells.get('a')!.version).toBe(0);
	});

	it('a cell changes word once when its content changes past the sensitivity', () => {
		const memory = memoryOf({}, 0)!;
		settleCell(memory, 'a', 1, 0.2, SETTLE);
		const cell = settleCell(memory, 'a', 1, 0.6, { ...SETTLE, time: 1 });
		settleCell(memory, 'a', 1, 0.62, { ...SETTLE, time: 1.1 });
		expect(cell.version).toBe(1);
		expect(cell.changedAt).toBe(1);
	});

	it('crossfades over the fade time instead of swapping', () => {
		expect(fadeOf(1, 1, 0.4)).toBe(0);
		expect(fadeOf(1, 1.2, 0.4)).toBeCloseTo(0.5);
		expect(fadeOf(1, 2, 0.4)).toBe(1);
	});

	it('shows a fragment above the threshold and keeps it until well below (hysteresis)', () => {
		const memory = memoryOf({}, 0)!;
		const cell = settleCell(memory, 'a', 1, 0, SETTLE);
		expect(gate(memory, cell, 0.5, 0.4, 0)).toBe(1);
		expect(gate(memory, cell, 0.3, 0.4, 0.1)).toBe(1);
		expect(gate(memory, cell, 0.2, 0.4, 0.2)).toBe(0);
		expect(gate(memory, cell, 0.35, 0.4, 0.3)).toBe(0);
	});

	it('forgets the past when time goes back (a video looping)', () => {
		const state = {};
		memoryOf(state, 0)!.cells.set('a', { reference: 0, version: 3, previous: 2, changedAt: 0, shown: true, shownAt: 0 });
		memoryOf(state, 2);
		expect(memoryOf(state, 0.5)!.cells.size).toBe(0);
	});

	it('finds the shift of a panned profile', () => {
		const previous = Float32Array.from({ length: 60 }, (_, i) => Math.sin(i / 3) * 100);
		const current = Float32Array.from({ length: 60 }, (_, i) => Math.sin((i - 4) / 3) * 100);
		expect(bestShift(previous, current)).toBe(4);
	});

	it('replaces a word with one of the same length so the line does not reflow', () => {
		const next = wordFor(['KEY', 'POD', 'TOKEN'], 3, 7, 2, 'ACL');
		expect(next.length).toBe(3);
		expect(wordFor(['KEY'], 3, 7, 0, 'ACL')).toBe('ACL');
	});
});
