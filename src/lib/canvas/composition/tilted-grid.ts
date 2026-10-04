import { clampParams } from './clamp';
import type { LayoutParam, LayoutParams, Transform } from './types';

export const params: LayoutParam[] = [
	{ name: 'columns', label: 'Columns', kind: 'range', min: 1, max: 8, step: 1, default: 3 },
	{ name: 'rows', label: 'Rows', kind: 'range', min: 1, max: 8, step: 1, default: 3 },
	{ name: 'gapX', label: 'Horizontal spacing', kind: 'range', min: 0.1, max: 10, step: 0.1, default: 2 },
	{ name: 'gapY', label: 'Vertical spacing', kind: 'range', min: 0.1, max: 10, step: 0.1, default: 2 },
	{ name: 'tiltX', label: 'Tilt X', kind: 'range', min: -45, max: 45, step: 1, default: 0 },
	{ name: 'tiltY', label: 'Tilt Y', kind: 'range', min: -45, max: 45, step: 1, default: 0 },
	{ name: 'tiltZ', label: 'Tilt Z', kind: 'range', min: -45, max: 45, step: 1, default: 0 },
	{ name: 'scrollSpeed', label: 'Scroll speed', kind: 'range', min: 0, max: 5, step: 0.1, default: 0 },
	{ name: 'waveDepth', label: 'Depth wave', kind: 'range', min: 0, max: 8, step: 0.1, default: 1.2 },
	{ name: 'waveSpeed', label: 'Wave speed', kind: 'range', min: 0, max: 4, step: 0.05, default: 0.6 },
	{ name: 'cardScale', label: 'Media scale', kind: 'range', min: 0.5, max: 3, step: 0.05, default: 1.15 },
	{
		name: 'scrollDirection',
		label: 'Scroll direction',
		kind: 'select',
		options: [
			{ value: 'vertical', label: 'Vertical' },
			{ value: 'horizontal', label: 'Horizontal' }
		],
		default: 'vertical'
	}
];

const DEGREES_TO_RADIANS = Math.PI / 180;

export function transforms(count: number, rawParams: LayoutParams, t: number): Transform[] {
	if (count <= 0) {
		return [];
	}

	const clamped = clampParams(params, rawParams);
	const columns = Math.max(1, Math.round(Number(clamped.columns)));
	const gapX = Number(clamped.gapX);
	const gapY = Number(clamped.gapY);
	const tiltX = Number(clamped.tiltX) * DEGREES_TO_RADIANS;
	const tiltY = Number(clamped.tiltY) * DEGREES_TO_RADIANS;
	const tiltZ = Number(clamped.tiltZ) * DEGREES_TO_RADIANS;
	const scrollSpeed = Number(clamped.scrollSpeed);
	const waveDepth = Number(clamped.waveDepth);
	const waveSpeed = Number(clamped.waveSpeed);
	const cardScale = Number(clamped.cardScale);
	const scrollDirection = String(clamped.scrollDirection);
	const rows = Math.ceil(count / columns);

	const originX = -((columns - 1) * gapX) / 2;
	const originY = ((rows - 1) * gapY) / 2;
	const scroll = scrollSpeed * t;

	const items: Transform[] = [];
	for (let index = 0; index < count; index++) {
		const column = index % columns;
		const row = Math.floor(index / columns);
		const x = originX + column * gapX + (scrollDirection === 'horizontal' ? scroll : 0);
		const y = originY - row * gapY - (scrollDirection === 'vertical' ? scroll : 0);
		const wave = Math.sin(column * 0.9 + row * 1.15 - t * waveSpeed * Math.PI * 2);
		const scale = cardScale * (1 + wave * 0.08);
		const waveRotation = waveDepth > 0 ? wave : 0;

		items.push({
			position: { x, y, z: wave * waveDepth },
			rotation: { x: tiltX + waveRotation * 0.04, y: tiltY - waveRotation * 0.08, z: tiltZ },
			scale: { x: scale, y: scale, z: scale }
		});
	}

	return items;
}
