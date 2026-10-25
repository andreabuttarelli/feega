import { describe, expect, it } from 'vitest';
import { layoutOf, LAYOUTS } from './index';
import { parseLayoutSpec, specDefinition, type LayoutSpec } from './spec';

const TILTED: LayoutSpec = {
	kind: 'spec',
	cards: '1:1',
	camera: 'selected',
	motion: 'ping-pong',
	slots: { param: 'slots' },
	params: [
		{ name: 'slots', label: 'Cards', kind: 'range', min: 1, max: 64, step: 1, default: 9 },
		{ name: 'cardScale', label: 'Media scale', kind: 'range', min: 0.5, max: 3, step: 0.05, default: 1.15 }
	],
	place: { kind: 'grid', columns: 3, gapX: 2, gapY: 2 },
	scale: { param: 'cardScale' },
	animate: [
		{ prop: 'z', amp: 1.2, freq: 0.6, phase: { column: 0.9, row: 1.15 } },
		{ prop: 'rotX', amp: 0.04, freq: 0.6, phase: { column: 0.9, row: 1.15 } },
		{ prop: 'rotY', amp: -0.08, freq: 0.6, phase: { column: 0.9, row: 1.15 } },
		{ prop: 'scale', amp: 0.092, freq: 0.6, phase: { column: 0.9, row: 1.15 } }
	]
};

const EPSILON = 1e-9;

describe('spec layouts', () => {
	it('a spec layout returns count transforms, finite, deterministic', () => {
		const def = specDefinition(TILTED);
		const a = def.transforms(7, {}, 0.37);
		const b = def.transforms(7, {}, 0.37);

		expect(a).toHaveLength(7);
		expect(a).toEqual(b);
		expect(a.flatMap((t) => [t.position.x, t.position.y, t.position.z, t.rotation.x, t.rotation.y, t.scale.x]).every(Number.isFinite)).toBe(true);
	});

	it('reproduces tilted-grid within epsilon', () => {
		const custom = specDefinition(TILTED);
		const builtin = LAYOUTS['tilted-grid'];

		for (const t of [0, 0.25, 0.5, 0.9]) {
			const mine = custom.transforms(9, {}, t);
			const theirs = builtin.transforms(9, { waveDepth: 1.2 }, t);
			mine.forEach((m, i) => {
				const o = theirs[i];
				for (const [x, y] of [[m.position.x, o.position.x], [m.position.y, o.position.y], [m.position.z, o.position.z], [m.rotation.x, o.rotation.x], [m.rotation.y, o.rotation.y], [m.scale.x, o.scale.x]]) {
					expect(Math.abs(x - y)).toBeLessThan(EPSILON);
				}
			});
		}
	});

	it('fills its slots from the media it is given', () => {
		expect(specDefinition(TILTED).instances(4, { slots: 9 })).toBe(9);
	});

	it('layoutOf returns the built-in for an id and the interpreted spec for custom', () => {
		expect(layoutOf('helix', null)).toBe(LAYOUTS.helix);
		expect(layoutOf('custom', TILTED).motion).toBe('ping-pong');
	});

	it.each([
		['a placement it does not know', { ...TILTED, place: { kind: 'spiral' } }],
		['a param it does not declare', { ...TILTED, scale: { param: 'nope' } }],
		['more than 200 slots', { ...TILTED, slots: 500 }]
	])('refuses %s', (_, spec) => {
		expect(parseLayoutSpec(spec).ok).toBe(false);
	});
});
