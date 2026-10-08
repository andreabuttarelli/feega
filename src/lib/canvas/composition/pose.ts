import { cameraAt, type CameraPresetId, type CameraState } from './camera';
import { layoutOf, mediaIndexFor, type CompositionLayout } from './index';
import type { LayoutSpec } from './spec';
import { MOTION_TIME } from './motion';
import type { LayoutParams, Transform } from './types';

export type PoseInput = {
	layout: CompositionLayout;
	layoutSpec?: LayoutSpec | null;
	layoutParams: LayoutParams;
	camera: CameraPresetId;
	cameraParams: LayoutParams;
	duration: number;
	mediaCount: number;
	aspect: number;
};

export type Pose = { transforms: Transform[]; camera: CameraState };

type FitInput = Pick<PoseInput, 'layout' | 'layoutSpec' | 'layoutParams' | 'camera' | 'cameraParams' | 'aspect'>;

export function activeParams(input: FitInput): LayoutParams {
	const fit = layoutOf(input.layout, input.layoutSpec).fit;
	return fit ? fit(input.layoutParams, cameraAt(input.camera, input.cameraParams, 0), input.aspect) : input.layoutParams;
}

export function instancesOf(input: PoseInput): number[] {
	const params = activeParams(input);
	const count = layoutOf(input.layout, input.layoutSpec).instances(input.mediaCount, params);
	return Array.from({ length: count }, (_, index) => mediaIndexFor(input.layout, index, count, params, input.mediaCount));
}

export function poseAt(input: PoseInput, t: number, count = instancesOf(input).length): Pose {
	const layout = layoutOf(input.layout, input.layoutSpec);
	const motionTime = MOTION_TIME[layout.motion](t, input.duration);
	const cameraTime = layout.camera === 'fixed' ? 0 : motionTime;

	return {
		transforms: layout.transforms(count, activeParams(input), motionTime),
		camera: cameraAt(input.camera, input.cameraParams, cameraTime)
	};
}
