declare module 'virtual:motion-generative' {
	const source: string;
	export default source;
}

declare module 'virtual:motion-fx' {
	const source: string;
	export default source;
}

declare module 'virtual:motion-twgl' {
	const source: string;
	export default source;
}

declare module 'poisson-disk-sampling' {
	export default class PoissonDiskSampling {
		constructor(options: { shape: number[]; minDistance: number; maxDistance?: number; tries?: number }, rng?: () => number);
		fill(): number[][];
	}
}

declare module 'simplify-js' {
	export default function simplify<P extends { x: number; y: number }>(points: P[], tolerance?: number, highestQuality?: boolean): P[];
}

declare module 'rbush' {
	export default class RBush<T> {
		insert(item: T): this;
		search(box: { minX: number; minY: number; maxX: number; maxY: number }): T[];
	}
}

declare module 'robust-point-in-polygon' {
	export default function inside(polygon: number[][], point: number[]): -1 | 0 | 1;
}

declare module 'clipper-lib' {
	const ClipperLib: Record<string, unknown>;
	export default ClipperLib;
}
