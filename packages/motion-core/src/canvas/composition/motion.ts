const EXPONENT = 3;
const FULL_TURN = Math.PI * 2;

export function closedExpoProgress(t: number, duration: number): number {
	if (duration <= 0) {
		return 0;
	}

	const phase = ((t % duration) + duration) % duration / duration;
	const leg = (1 - Math.cos(phase * FULL_TURN)) / 2;
	return easeInOutExpo(leg);
}

export function loopPhase(t: number, duration: number): number {
	if (duration <= 0) {
		return 0;
	}

	return ((t % duration) + duration) % duration / duration;
}

export type Motion = 'cycle' | 'ping-pong' | 'linear';

export const MOTION_TIME: Record<Motion, (t: number, duration: number) => number> = {
	cycle: (t, duration) => closedExpoPhase(t, duration),
	'ping-pong': (t, duration) => closedExpoProgress(t, duration),
	linear: (t, duration) => loopPhase(t, duration)
};

export function closedExpoPhase(t: number, duration: number): number {
	if (duration <= 0) {
		return 0;
	}

	const phase = ((t % duration) + duration) % duration / duration;
	return easeInOutExpo(phase);
}

export function easeInOutExpo(value: number): number {
	if (value <= 0 || value >= 1) {
		return value;
	}

	const scale = 2 * (Math.pow(2, EXPONENT) - 1);

	if (value < 0.5) {
		return (Math.pow(2, EXPONENT * 2 * value) - 1) / scale;
	}

	return 1 - (Math.pow(2, EXPONENT * 2 * (1 - value)) - 1) / scale;
}
