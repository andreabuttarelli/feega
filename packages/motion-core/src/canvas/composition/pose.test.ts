import { describe, expect, it } from 'vitest';
import { cameraAt } from './camera';
import { LAYOUTS, instanceCountFor, mediaIndexFor } from './index';
import { MOTION_TIME } from './motion';
import { instancesOf, poseAt, type PoseInput } from './pose';
import type { LayoutId } from './types';

const PORTRAIT = 9 / 16;
const SAMPLES = [0, 0.4, 1.7, 3.2, 5.9];

function inputFor(layout: LayoutId): PoseInput {
	return { layout, layoutParams: {}, camera: 'slow-orbit', cameraParams: {}, duration: 6, mediaCount: 3, aspect: PORTRAIT };
}

describe('poseAt', () => {
	for (const layout of Object.keys(LAYOUTS) as LayoutId[]) {
		it(`${layout} poses media the way the canvas scene always did`, () => {
			const input = inputFor(layout);
			for (const t of SAMPLES) {
				const motionTime = MOTION_TIME[LAYOUTS[layout].motion](t, 6);
				const params = LAYOUTS[layout].fit?.({}, cameraAt('slow-orbit', {}, 0), PORTRAIT) ?? {};
				const count = instanceCountFor(layout, 3, params);
				const expected = LAYOUTS[layout].transforms(count, params, motionTime);
				const camera = cameraAt('slow-orbit', {}, LAYOUTS[layout].camera === 'fixed' ? 0 : motionTime);

				expect(poseAt(input, t)).toEqual({ transforms: expected, camera });
			}
		});
	}

	it('assigns each instance the media the canvas scene assigned it', () => {
		const input = { ...inputFor('tilted-grid'), mediaCount: 2 };
		const count = instanceCountFor('tilted-grid', 2, {});

		expect(instancesOf(input)).toEqual(Array.from({ length: count }, (_, i) => mediaIndexFor('tilted-grid', i, count, {}, 2)));
	});

	it('has no instances without media', () => {
		expect(instancesOf({ ...inputFor('helix'), mediaCount: 0 })).toEqual([]);
	});
});
