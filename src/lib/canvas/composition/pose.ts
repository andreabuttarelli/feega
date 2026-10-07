import { cameraAt, type CameraPresetId, type CameraState } from './camera';
import { fitViewport } from './explorer-grid';
import { instanceCountFor, LAYOUTS, mediaIndexFor } from './index';
import { closedExpoPhase, closedExpoProgress } from './motion';
import type { LayoutId, LayoutParams, Transform } from './types';

export type PoseInput = {
	layout: LayoutId;
	layoutParams: LayoutParams;
	camera: CameraPresetId;
	cameraParams: LayoutParams;
	duration: number;
	mediaCount: number;
	aspect: number;
};

export type Pose = { transforms: Transform[]; camera: CameraState };

type FitInput = Pick<PoseInput, 'layout' | 'layoutParams' | 'camera' | 'cameraParams' | 'aspect'>;

export function activeParams(input: FitInput): LayoutParams {
	if (input.layout !== 'explorer-grid') {
		return input.layoutParams;
	}
	return fitViewport(input.layoutParams, cameraAt(input.camera, input.cameraParams, 0), input.aspect).params;
}

export function instancesOf(input: PoseInput): number[] {
	const params = activeParams(input);
	const count = instanceCountFor(input.layout, input.mediaCount, params);
	return Array.from({ length: count }, (_, index) => mediaIndexFor(input.layout, index, count, params, input.mediaCount));
}

export function poseAt(input: PoseInput, t: number, count = instancesOf(input).length): Pose {
	const layout = LAYOUTS[input.layout];
	const motionTime = layout.motion === 'cycle' ? closedExpoPhase(t, input.duration) : closedExpoProgress(t, input.duration);
	const cameraTime = layout.camera === 'fixed' ? 0 : motionTime;

	return {
		transforms: layout.transforms(count, activeParams(input), motionTime),
		camera: cameraAt(input.camera, input.cameraParams, cameraTime)
	};
}
