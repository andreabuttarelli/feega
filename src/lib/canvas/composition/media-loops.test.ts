import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cameraAt } from './camera';
import { LAYOUTS } from './index';
import { instancesOf, poseAt, type PoseInput } from './pose';
import type { LayoutId, Transform } from './types';

const MEDIA_LOOPS: LayoutId[] = [
	'marquee',
	'stack',
	'perspective-wall',
	'film-strip',
	'split-reveal',
	'polaroid',
	'masonry',
	'slider'
];
const ASPECTS = { portrait: 9 / 16, square: 1, landscape: 16 / 9 };
const LOOP_SECONDS = 8;
const FPS = 30;
const VISIBLE = 0.1;
const CARD_HALF = 0.5;
const STILL = { distance: 12, fov: 50 };

function inputFor(layout: LayoutId, aspect: number, mediaCount = 10): PoseInput {
	return { layout, layoutParams: {}, camera: 'static', cameraParams: STILL, duration: LOOP_SECONDS, mediaCount, aspect };
}

function viewOf(aspect: number): THREE.PerspectiveCamera {
	const state = cameraAt('static', STILL, 0);
	const camera = new THREE.PerspectiveCamera(state.fov, aspect, 0.1, 500);
	camera.position.set(state.position.x, state.position.y, state.position.z);
	camera.lookAt(state.target.x, state.target.y, state.target.z);
	camera.updateMatrixWorld();
	camera.updateProjectionMatrix();
	return camera;
}

function corners(transform: Transform): THREE.Vector3[] {
	const object = new THREE.Object3D();
	object.position.set(transform.position.x, transform.position.y, transform.position.z);
	object.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
	object.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
	object.updateMatrixWorld();
	return [
		[-CARD_HALF, -CARD_HALF],
		[CARD_HALF, -CARD_HALF],
		[CARD_HALF, CARD_HALF],
		[-CARD_HALF, CARD_HALF]
	].map(([x, y]) => new THREE.Vector3(x, y, 0).applyMatrix4(object.matrixWorld));
}

function onScreen(transform: Transform, camera: THREE.PerspectiveCamera): boolean {
	return corners(transform).some((corner) => {
		const point = corner.clone().project(camera);
		return point.z < 1 && Math.abs(point.x) < 1 && Math.abs(point.y) < 1;
	});
}

function inside(transform: Transform, camera: THREE.PerspectiveCamera): boolean {
	return corners(transform).every((corner) => {
		const point = corner.clone().project(camera);
		return point.z < 1 && Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1;
	});
}

function seconds(): number[] {
	return Array.from({ length: LOOP_SECONDS * FPS }, (_, frame) => frame / FPS);
}

describe('media loop compositions', () => {
	for (const layout of MEDIA_LOOPS) {
		describe(layout, () => {
			it('is a template on a fixed camera that moves at constant pace', () => {
				expect(LAYOUTS[layout].camera).toBe('fixed');
				expect(LAYOUTS[layout].motion).toBe('linear');
			});

			it('poses the same frame the same way however it is reached', () => {
				const input = inputFor(layout, ASPECTS.portrait);
				const shuffled = [5.3, 0.2, 7.9, 2.6];

				for (const t of shuffled) {
					expect(poseAt(input, t)).toEqual(poseAt(input, t));
				}
				expect(poseAt(input, 2.6).transforms).toEqual(poseAt(inputFor(layout, ASPECTS.portrait), 2.6).transforms);
			});

			it('closes the loop: the last frame leads back into the first', () => {
				const input = inputFor(layout, ASPECTS.portrait);
				const first = poseAt(input, 0).transforms;
				const wrapped = poseAt(input, LOOP_SECONDS).transforms;

				wrapped.forEach((transform, index) => {
					expect(transform.position.x).toBeCloseTo(first[index].position.x, 6);
					expect(transform.position.y).toBeCloseTo(first[index].position.y, 6);
					expect(transform.position.z).toBeCloseTo(first[index].position.z, 6);
					expect(transform.opacity ?? 1).toBeCloseTo(first[index].opacity ?? 1, 6);
				});
			});

			for (const [name, aspect] of Object.entries(ASPECTS)) {
				it(`never leaves a ${name} frame empty and shows media on every frame`, () => {
					const input = inputFor(layout, aspect);
					const camera = viewOf(aspect);

					for (const t of seconds()) {
						const shown = poseAt(input, t).transforms.filter((transform) => (transform.opacity ?? 1) >= VISIBLE && onScreen(transform, camera));
						expect({ t, shown: shown.length > 0 }).toEqual({ t, shown: true });
					}
				});
			}

			it('uses every media item it is given', () => {
				const input = inputFor(layout, ASPECTS.landscape, 12);

				expect(new Set(instancesOf(input))).toEqual(new Set(Array.from({ length: 12 }, (_, index) => index)));
			});
		});
	}

	const HELD: LayoutId[] = ['stack', 'polaroid', 'split-reveal'];

	for (const layout of HELD) {
		it(`${layout} rests its front media wholly inside every frame shape`, () => {
			for (const aspect of Object.values(ASPECTS)) {
				const input = inputFor(layout, aspect);
				const camera = viewOf(aspect);
				const front = poseAt(input, 0).transforms.filter((transform) => (transform.opacity ?? 1) > 0.99);

				expect(front.length).toBeGreaterThan(0);
				expect(front.filter((transform) => !inside(transform, camera))).toEqual([]);
			}
		});
	}

	const ENDLESS: LayoutId[] = ['marquee', 'masonry'];

	for (const layout of ENDLESS) {
		it(`${layout} wraps its cards around out of sight`, () => {
			for (const aspect of Object.values(ASPECTS)) {
				const input = inputFor(layout, aspect);
				const camera = viewOf(aspect);

				for (const t of seconds()) {
					const fading = poseAt(input, t).transforms.filter((transform) => (transform.opacity ?? 1) < 0.99);
					expect(fading.filter((transform) => onScreen(transform, camera))).toEqual([]);
				}
			}
		});
	}
});
