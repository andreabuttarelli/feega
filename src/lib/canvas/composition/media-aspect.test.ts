import { describe, expect, it } from 'vitest';
import { aspectValue, cardBox, CARD_ASPECTS } from './card-look';
import { LAYOUTS } from './index';
import { instancesOf, poseAt, type PoseInput } from './pose';
import type { LayoutId, Transform } from './types';

const MIXED = CARD_ASPECTS.filter((a) => a !== 'original').map((a) => aspectValue(a, 1.4));
const TIMES = [0, 1.3, 2.9, 4.4, 6.1];
const FLAT = 1e-3;
const MEDIA = 8;

const SHAPED = (Object.keys(LAYOUTS) as LayoutId[]).filter((id) => LAYOUTS[id].params.some((p) => p.name === 'cardAspect'));

function inputFor(layout: LayoutId): PoseInput {
	return { layout, layoutParams: {}, camera: 'static', cameraParams: {}, duration: 8, mediaCount: MEDIA, aspect: 9 / 16 };
}

type Box = { x0: number; x1: number; y0: number; y1: number; z: number };

function boxOf(t: Transform, sx: number, sy: number): Box {
	const w = (t.scale.x * sx) / 2;
	const h = (t.scale.y * sy) / 2;
	return { x0: t.position.x - w, x1: t.position.x + w, y0: t.position.y - h, y1: t.position.y + h, z: t.position.z };
}

function overlap(a: Box, b: Box): number {
	const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
	const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
	return w > 0 && h > 0 ? w * h : 0;
}

const flat = (t: Transform) => Math.abs(t.rotation.x) < FLAT && Math.abs(t.rotation.y) < FLAT && Math.abs(t.rotation.z) < FLAT;

describe('cards of mixed aspect ratios', () => {
	it('every media layout takes a card ratio setting', () => {
		const html = ['ring', 'bento'];
		expect(SHAPED.sort()).toEqual((Object.keys(LAYOUTS) as LayoutId[]).filter((id) => !html.includes(id)).sort());
	});

	for (const layout of SHAPED) {
		it(`${layout} never overlaps two cards that its square poses keep apart`, () => {
			const input = inputFor(layout);
			const media = instancesOf(input);

			for (const t of TIMES) {
				const poses = poseAt(input, t).transforms;
				const marks = LAYOUTS[layout].solids?.(poses.length, input.layoutParams) ?? 0;
				const cards = poses.slice(0, poses.length - marks).map((pose, i) => ({ pose, box: cardBox(MIXED[media[i] % MIXED.length]) }));

				for (let i = 0; i < cards.length; i++) {
					const a = cards[i];
					expect(a.box[0]).toBeLessThanOrEqual(1);
					expect(a.box[1]).toBeLessThanOrEqual(1);
					for (let j = i + 1; j < cards.length; j++) {
						const b = cards[j];
						if (!flat(a.pose) || !flat(b.pose) || Math.abs(a.pose.position.z - b.pose.position.z) > FLAT) {
							continue;
						}
						const square = overlap(boxOf(a.pose, 1, 1), boxOf(b.pose, 1, 1));
						const shaped = overlap(boxOf(a.pose, ...a.box), boxOf(b.pose, ...b.box));
						expect(shaped).toBeLessThanOrEqual(square + 1e-9);
					}
				}
			}
		});
	}
});
