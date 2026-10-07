import { describe, expect, it } from 'vitest';
import { cutoutTwin, upstreamImageRef, upstreamMedia } from './effects-node';

const edges = [{ source: 'img', target: 'fx' }];

describe('upstreamImageRef', () => {
	it('reads the result of a generating node', () => {
		expect(upstreamImageRef('fx', edges, [{ id: 'img', data: { refId: 'a1' } }])).toBe('a1');
	});

	it('reads the asset of an uploaded image', () => {
		expect(upstreamImageRef('fx', edges, [{ id: 'img', data: { assetId: 'a2' } }])).toBe('a2');
	});

	it('is null when nothing with an image feeds the node', () => {
		expect(upstreamImageRef('fx', edges, [{ id: 'img', data: {} }])).toBeNull();
		expect(upstreamImageRef('fx', [], [{ id: 'img', data: { refId: 'a1' } }])).toBeNull();
	});
});

describe('upstreamMedia', () => {
	it('keeps the medium of a video source', () => {
		expect(upstreamMedia('fx', edges, [{ id: 'img', type: 'video', data: { refId: 'v1' } }])).toEqual({ refId: 'v1', kind: 'video' });
	});

	it('defaults legacy uploaded media to image', () => {
		expect(upstreamMedia('fx', edges, [{ id: 'img', type: 'media', data: { assetId: 'a1' } }])).toEqual({ refId: 'a1', kind: 'image' });
	});
});

describe('cutoutTwin', () => {
	const cutout = (side: string, seed = 3) => ({ effects: [{ id: 'shape-cutout', params: { seed, side }, enabled: true }] });
	const wires = [
		{ source: 'img', target: 'a' },
		{ source: 'img', target: 'b' }
	];

	it('finds the other side of the pair, fed by the same image, from either node', () => {
		const nodes = [
			{ id: 'a', type: 'effects', data: cutout('shapes') },
			{ id: 'b', type: 'effects', data: { effects: [{ id: 'shape-cutout', params: { side: 'holes', seed: 3 }, enabled: true }] } }
		];

		expect(cutoutTwin('a', wires, nodes)).toBe('b');
		expect(cutoutTwin('b', wires, nodes)).toBe('a');
	});

	it('is null when no node matches: other seed, same side, or another image', () => {
		const a = { id: 'a', type: 'effects', data: cutout('shapes') };

		expect(cutoutTwin('a', wires, [a, { id: 'b', type: 'effects', data: cutout('holes', 4) }])).toBeNull();
		expect(cutoutTwin('a', wires, [a, { id: 'b', type: 'effects', data: cutout('shapes') }])).toBeNull();
		expect(cutoutTwin('a', [wires[0], { source: 'other', target: 'b' }], [a, { id: 'b', type: 'effects', data: cutout('holes') }])).toBeNull();
	});
});
