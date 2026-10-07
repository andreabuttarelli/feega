import * as bento from './bento';
import type { CameraState } from './camera';
import { cardParams, type CardAspect } from './card-look';
import * as filmStrip from './film-strip';
import { withFrame } from './loop';
import * as marquee from './marquee';
import * as masonry from './masonry';
import type { Motion } from './motion';
import * as perspectiveWall from './perspective-wall';
import * as polaroid from './polaroid';
import * as slider from './slider';
import * as splitReveal from './split-reveal';
import * as stack from './stack';
import * as carousel3d from './carousel-3d';
import * as coverflow from './coverflow';
import * as explorerGrid from './explorer-grid';
import * as helix from './helix';
import * as staggeredGrid from './staggered-grid';
import * as mediaCloud from './media-cloud';
import * as mediaRing from './media-ring';
import * as ring from './ring';
import * as tiltedGrid from './tilted-grid';
import * as verticalFlow from './vertical-flow';
import type { LayoutId, LayoutParam, LayoutParams, Transform } from './types';

type LayoutDefinition = {
	label: string;
	description: string;
	motion: Motion;
	camera: 'fixed' | 'selected';
	params: LayoutParam[];
	fit?: (params: LayoutParams, camera: CameraState, aspect: number) => LayoutParams;
	cards?: CardAspect;
	solids?: (count: number, params: LayoutParams) => number;
	instances: (mediaCount: number, params: LayoutParams) => number;
	transforms: (count: number, params: LayoutParams, t: number) => Transform[];
};

const DEFINED: Record<LayoutId, LayoutDefinition> = {
	'tilted-grid': {
		cards: '1:1',
		label: 'Kinetic grid',
		description: 'A tilted wall of cards that sways back and forth.',
		motion: 'ping-pong',
		camera: 'selected',
		params: tiltedGrid.params,
		instances: (mediaCount, values) => filledCount(mediaCount, valueOf(values, 'columns', 3) * valueOf(values, 'rows', 3)),
		transforms: tiltedGrid.transforms
	},
	'carousel-3d': {
		cards: '1:1',
		label: 'Orbital carousel',
		description: 'Cards orbit a centre like a 3D carousel.',
		motion: 'cycle',
		camera: 'fixed',
		params: carousel3d.params,
		instances: (mediaCount, values) => filledCount(mediaCount, valueOf(values, 'slots', 7)),
		transforms: carousel3d.transforms
	},
	'media-cloud': {
		cards: '1:1',
		label: 'Cinematic cloud',
		description: 'Cards drift through depth in a loose cloud.',
		motion: 'cycle',
		camera: 'fixed',
		params: mediaCloud.params,
		instances: (mediaCount, values) => filledCount(mediaCount, valueOf(values, 'density', 10)),
		transforms: mediaCloud.transforms
	},
	'media-ring': {
		cards: '1:1',
		label: 'Synced rings',
		description: 'Rings of cards turning in step.',
		motion: 'ping-pong',
		camera: 'selected',
		params: mediaRing.params,
		instances: (mediaCount, values) =>
			filledCount(mediaCount, valueOf(values, 'rings', 1) * valueOf(values, 'itemsPerRing', 12)),
		transforms: mediaRing.transforms
	},
	helix: {
		cards: '1:1',
		label: 'Helix',
		description: 'A spiral of cards turning around its axis.',
		motion: 'ping-pong',
		camera: 'selected',
		params: helix.params,
		instances: (mediaCount, values) => filledCount(mediaCount, valueOf(values, 'items', 10)),
		transforms: helix.transforms
	},
	'explorer-grid': {
		cards: '1:1',
		label: 'Explorer grid',
		description: 'An endless grid that glides from card to card.',
		motion: 'cycle',
		camera: 'fixed',
		params: explorerGrid.params,
		fit: (values, camera, aspect) => explorerGrid.fitViewport(values, camera, aspect).params,
		instances: explorerGrid.instanceCount,
		transforms: explorerGrid.transforms
	},
	'staggered-grid': {
		cards: '1:1',
		label: 'Staggered columns',
		description: 'Columns scrolling at offset heights.',
		motion: 'cycle',
		camera: 'fixed',
		params: staggeredGrid.params,
		instances: (mediaCount, values) =>
			filledCount(mediaCount, valueOf(values, 'columns', 3) * valueOf(values, 'rows', 3)),
		transforms: staggeredGrid.transforms
	},
	'vertical-flow': {
		cards: '1:1',
		label: 'Vertical flow',
		description: 'A stream of cards rising through the frame.',
		motion: 'cycle',
		camera: 'fixed',
		params: verticalFlow.params,
		instances: (mediaCount, values) => filledCount(mediaCount, valueOf(values, 'items', 7)),
		transforms: verticalFlow.transforms
	},
	coverflow: {
		cards: '1:1',
		label: 'Editorial coverflow',
		description: 'A front card with its neighbours angled away.',
		motion: 'cycle',
		camera: 'fixed',
		params: coverflow.params,
		instances: (mediaCount, values) => filledCount(mediaCount, valueOf(values, 'items', 5)),
		transforms: coverflow.transforms
	},
	ring: {
		label: 'UI ring',
		description: 'Cards curved on a tilted, turning cylinder; the ones behind show through.',
		motion: 'cycle',
		camera: 'fixed',
		params: ring.params,
		instances: (mediaCount, values) => filledCount(mediaCount, valueOf(values, 'count', ring.RING_COUNT.fallback)),
		transforms: ring.transforms
	},
	bento: {
		label: 'Bento',
		description: 'A grid of rounded cells, some spanning rows or columns, each holding a picture, a video or a motion.',
		motion: 'cycle',
		camera: 'fixed',
		params: bento.params,
		instances: (mediaCount) => mediaCount,
		transforms: (count, values) => bento.transforms(count, values)
	},
	marquee: {
		cards: '1:1',
		label: 'Marquee',
		description: 'Endless rows of cards gliding in alternate directions, each row at its own pace.',
		motion: 'linear',
		camera: 'fixed',
		params: marquee.params,
		fit: withFrame,
		instances: marquee.instances,
		transforms: marquee.transforms
	},
	stack: {
		cards: 'original',
		label: 'Card stack',
		description: 'A pile of cards; the front one slides away and the next comes forward.',
		motion: 'linear',
		camera: 'fixed',
		params: stack.params,
		instances: stack.instances,
		transforms: stack.transforms
	},
	'perspective-wall': {
		cards: '1:1',
		label: 'Perspective wall',
		description: 'A wall of media receding in perspective, panning slowly.',
		motion: 'linear',
		camera: 'fixed',
		params: perspectiveWall.params,
		instances: perspectiveWall.instances,
		transforms: perspectiveWall.transforms
	},
	'film-strip': {
		cards: '1:1',
		label: 'Film strip',
		description: 'A strip of cards that steps along, one card in focus at a time.',
		motion: 'linear',
		camera: 'fixed',
		params: filmStrip.params,
		instances: filmStrip.instances,
		transforms: filmStrip.transforms
	},
	'split-reveal': {
		cards: '1:1',
		label: 'Split reveal',
		description: 'Panels side by side that part up and down to reveal the next set.',
		motion: 'linear',
		camera: 'fixed',
		params: splitReveal.params,
		fit: withFrame,
		instances: splitReveal.instances,
		transforms: splitReveal.transforms
	},
	polaroid: {
		cards: 'original',
		label: 'Polaroid pile',
		description: 'Slightly turned cards that settle on a pile one after another.',
		motion: 'linear',
		camera: 'fixed',
		params: polaroid.params,
		instances: polaroid.instances,
		transforms: polaroid.transforms
	},
	masonry: {
		cards: '1:1',
		label: 'Masonry scroll',
		description: 'Masonry columns of different widths scrolling at different speeds.',
		motion: 'linear',
		camera: 'fixed',
		params: masonry.params,
		fit: withFrame,
		instances: masonry.instances,
		transforms: masonry.transforms
	},
	slider: {
		cards: 'original',
		label: 'Slider',
		description: 'One media at a time in the centre, sliding, fading or pushing to the next; optional dots or progress bar.',
		motion: 'linear',
		camera: 'fixed',
		params: slider.params,
		fit: withFrame,
		instances: slider.instances,
		solids: slider.solids,
		transforms: slider.transforms
	}
};

export const LAYOUTS = Object.fromEntries(
	Object.entries(DEFINED).map(([id, def]) => [id, def.cards ? { ...def, params: [...def.params, ...cardParams(def.cards)] } : def])
) as Record<LayoutId, LayoutDefinition>;

export function layoutAt(id: LayoutId, count: number, params: LayoutParams, t: number): Transform[] {
	return LAYOUTS[id].transforms(count, params, t);
}

export function instanceCountFor(id: LayoutId, mediaCount: number, params: LayoutParams): number {
	return LAYOUTS[id].instances(mediaCount, params);
}

export function mediaIndexFor(
	id: LayoutId,
	index: number,
	_count: number,
	params: LayoutParams,
	mediaCount: number
): number {
	if (mediaCount <= 1) {
		return 0;
	}

	if (id === 'tilted-grid' || id === 'explorer-grid') {
		const columns = id === 'explorer-grid'
			? explorerGrid.renderColumns(params)
			: valueOf(params, 'columns', 3);
		const column = index % columns;
		const row = Math.floor(index / columns);
		return (column + row) % mediaCount;
	}

	if (id === 'staggered-grid') {
		const rows = valueOf(params, 'rows', 3);
		const column = Math.floor(index / rows);
		const row = index % rows;
		return (column + row) % mediaCount;
	}

	if (id === 'media-ring') {
		const rings = valueOf(params, 'rings', 1);
		const ring = index % rings;
		const ringIndex = Math.floor(index / rings);
		return (ringIndex + ring) % mediaCount;
	}

	return index % mediaCount;
}

function valueOf(params: LayoutParams, name: string, fallback: number): number {
	const value = Number(params[name] ?? fallback);
	return Number.isFinite(value) ? Math.max(1, Math.round(value)) : fallback;
}

function filledCount(mediaCount: number, desired: number): number {
	return mediaCount > 0 ? Math.max(mediaCount, desired) : 0;
}

export type { LayoutId, LayoutParam, LayoutParams, Transform, Vec3 } from './types';
