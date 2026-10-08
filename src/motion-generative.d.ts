declare module 'virtual:motion-generative' {
	const source: string;
	export default source;
}

declare module 'virtual:motion-fx' {
	const source: string;
	export default source;
}

declare module 'virtual:motion-splitting' {
	const source: string;
	export default source;
}

declare module 'splitting' {
	type Split = { el: HTMLElement; chars?: HTMLElement[]; words?: HTMLElement[]; lines?: HTMLElement[][]; cells?: HTMLElement[] };
	export default function Splitting(options?: { target?: string | Element | Element[] | NodeList; by?: string; key?: string }): Split[];
}

declare module 'virtual:motion-open-props' {
	const source: string;
	export default source;
}

declare module 'virtual:motion-shader-fx' {
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
