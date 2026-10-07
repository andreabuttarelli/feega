import { clampParams } from './clamp';
import { card, frameOf, hashed } from './loop';
import type { LayoutParam, LayoutParams, Transform } from './types';

export const params: LayoutParam[] = [
	{ name: 'layers', label: 'Layers', kind: 'range', min: 2, max: 4, step: 1, default: 3 },
	{ name: 'perLayer', label: 'Media per layer', kind: 'range', min: 1, max: 5, step: 1, default: 3 },
	{ name: 'depth', label: 'Layer depth', kind: 'range', min: 1, max: 12, step: 0.5, default: 6 },
	{ name: 'scale', label: 'Card size', kind: 'range', min: 0.5, max: 4, step: 0.05, default: 2.3 },
	{ name: 'travel', label: 'Camera travel', kind: 'range', min: 0, max: 4, step: 0.05, default: 1.1 },
	{ name: 'fade', label: 'Haze on far layers', kind: 'range', min: 0, max: 0.8, step: 0.05, default: 0.35 },
	{ name: 'seed', label: 'Arrangement', kind: 'seed', default: 7 }
];

const CAMERA_DISTANCE = 12;
const FULL_TURN = Math.PI * 2;
const SPREAD = 0.78;
const JITTER = 0.35;

export function instances(mediaCount: number, rawParams: LayoutParams): number {
	if (mediaCount <= 0) {
		return 0;
	}

	const values = clampParams(params, rawParams);
	return Math.max(mediaCount, Math.round(Number(values.layers)) * Math.round(Number(values.perLayer)));
}

export function transforms(count: number, rawParams: LayoutParams, t: number): Transform[] {
	if (count <= 0) {
		return [];
	}

	const values = clampParams(params, rawParams);
	const layers = Math.round(Number(values.layers));
	const perLayer = Math.round(Number(values.perLayer));
	const depth = Number(values.depth);
	const scale = Number(values.scale);
	const travel = Number(values.travel);
	const fade = Number(values.fade);
	const seed = Number(values.seed);
	const frame = frameOf(rawParams);
	const panX = Math.sin(t * FULL_TURN) * travel;
	const panY = (1 - Math.cos(t * FULL_TURN)) * travel * 0.25;

	return Array.from({ length: count }, (_, index) => {
		const layer = Math.floor(index / perLayer) % layers;
		const slot = index % perLayer;
		const z = -layer * depth;
		const reach = (CAMERA_DISTANCE - z) / CAMERA_DISTANCE;
		const column = perLayer > 1 ? slot / (perLayer - 1) - 0.5 : 0;
		const band = ((slot * layers + layer + 0.5) / (layers * perLayer) - 0.5) * frame.height * SPREAD;
		const x = column * frame.width * SPREAD * reach + (hashed(seed, index, 1) - 0.5) * JITTER * scale;
		const y = band * reach + (hashed(seed, index, 2) - 0.5) * JITTER * scale;

		return card({ x: x - panX, y: y - panY, z }, scale, 1 - fade * (layer / Math.max(1, layers - 1)));
	});
}
