import { MotionStyle, STYLE_EASES } from '../../motion/style-model';
import { easeCurve } from '../../motion/sample-track';
import { clampParams } from './clamp';
import { card, centered, frameOf, smoothstep, stepAt, type Frame } from './loop';
import type { LayoutParam, LayoutParams, Transform } from './types';

export const SLIDER_VARIANTS = ['slide-x', 'slide-y', 'crossfade', 'push', 'peek'] as const;
export type SliderVariant = (typeof SLIDER_VARIANTS)[number];

const INDICATORS = ['none', 'dots', 'bar'] as const;
type Indicator = (typeof INDICATORS)[number];

export const params: LayoutParam[] = [
	{ name: 'variant', label: 'Transition', kind: 'select', options: SLIDER_VARIANTS.map((value) => ({ value, label: value })), default: 'slide-x' },
	{ name: 'hold', label: 'Hold', kind: 'range', min: 0.2, max: 0.9, step: 0.05, default: 0.7 },
	{ name: 'fill', label: 'Frame fill', kind: 'range', min: 0.4, max: 1, step: 0.02, default: 0.86 },
	{ name: 'gap', label: 'Peek gap', kind: 'range', min: 0, max: 1.5, step: 0.05, default: 0.25 },
	{ name: 'indicators', label: 'Indicators', kind: 'select', options: INDICATORS.map((value) => ({ value, label: value })), default: 'none' }
];

const ease = easeCurve(STYLE_EASES[MotionStyle.AppleMinimal].move);
const GONE = 0.98;
const PEEK_SIZE = 0.7;
const PEEK_SHRINK = 0.12;
const PEEK_DIM = 0.5;
const PUSH_DRIFT = 0.3;
const PUSH_SHRINK = 0.08;
const PUSH_DIM = 0.6;
const ABOVE = 0.01;
const INDICATOR_HEADROOM = 0.9;
const MARK = 0.022;
const MARK_PITCH = 2.6;
const MARK_MARGIN = 0.05;
const MARK_DIM = 0.35;
const BAR_WIDTH = 0.4;
const BAR_THICKNESS = 0.4;
const BAR_TRACK = 0.3;
const MARK_LIFT = 0.05;

type Slide = { x: number; y: number; z: number; grow: number; opacity: number };
type Stage = { frame: Frame; size: number; gap: number };

const away = (r: number) => 1 - smoothstep(GONE, 1, Math.abs(r));

const VARIANTS: Record<SliderVariant, (r: number, stage: Stage) => Slide> = {
	'slide-x': (r, { frame }) => ({ x: r * frame.width, y: 0, z: 0, grow: 1, opacity: away(r) }),
	'slide-y': (r, { frame }) => ({ x: 0, y: -r * frame.height, z: 0, grow: 1, opacity: away(r) }),
	crossfade: (r) => ({ x: 0, y: 0, z: r > 0 ? ABOVE : 0, grow: 1, opacity: r > 0 ? Math.max(0, 1 - r) : away(r) }),
	push: (r, { frame }) =>
		r > 0
			? { x: r * frame.width, y: 0, z: ABOVE, grow: 1, opacity: away(r) }
			: { x: r * frame.width * PUSH_DRIFT, y: 0, z: 0, grow: 1 + PUSH_SHRINK * r, opacity: (1 + r * PUSH_DIM) * away(r) },
	peek: (r, { size, gap }) => {
		const near = Math.min(1, Math.abs(r));
		const shown = 1 - smoothstep(1.2, 1.6, Math.abs(r));
		return { x: r * (size * PEEK_SIZE + gap), y: 0, z: -near * ABOVE, grow: PEEK_SIZE * (1 - PEEK_SHRINK * near), opacity: (1 - PEEK_DIM * near) * shown };
	}
};

type Marks = { marks: (cards: number) => number; cards: (count: number) => number; headroom: number };

const MARKS: Record<Indicator, Marks> = {
	none: { marks: () => 0, cards: (count) => count, headroom: 1 },
	dots: { marks: (cards) => cards, cards: (count) => count / 2, headroom: INDICATOR_HEADROOM },
	bar: { marks: () => 2, cards: (count) => count - 2, headroom: INDICATOR_HEADROOM }
};

const indicatorOf = (values: LayoutParams) => String(values.indicators) as Indicator;

export function instances(mediaCount: number, rawParams: LayoutParams): number {
	if (mediaCount <= 0) {
		return 0;
	}

	const cards = Math.max(mediaCount, 2);
	return cards + MARKS[indicatorOf(clampParams(params, rawParams))].marks(cards);
}

export function solids(count: number, rawParams: LayoutParams): number {
	return count - MARKS[indicatorOf(clampParams(params, rawParams))].cards(count);
}

function dots(cards: number, position: number, frame: Frame): Transform[] {
	const size = Math.min(frame.width, frame.height) * MARK;
	const pitch = size * MARK_PITCH;
	const y = -frame.height / 2 + frame.height * MARK_MARGIN;

	return Array.from({ length: cards }, (_, index) => {
		const near = 1 - Math.min(1, Math.abs(centered(index - position, cards)));
		return card({ x: (index - (cards - 1) / 2) * pitch, y, z: MARK_LIFT }, size, MARK_DIM + (1 - MARK_DIM) * near);
	});
}

function bar(within: number, frame: Frame): Transform[] {
	const width = frame.width * BAR_WIDTH;
	const thickness = Math.min(frame.width, frame.height) * MARK * BAR_THICKNESS;
	const y = -frame.height / 2 + frame.height * MARK_MARGIN;
	const filled = Math.max(1e-4, width * within);
	const track = { position: { x: 0, y, z: MARK_LIFT }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: width, y: thickness, z: 1 }, opacity: BAR_TRACK };
	const fill = { position: { x: (filled - width) / 2, y, z: MARK_LIFT * 2 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: filled, y: thickness, z: 1 }, opacity: 1 };
	return [track, fill];
}

export function transforms(count: number, rawParams: LayoutParams, t: number): Transform[] {
	if (count <= 0) {
		return [];
	}

	const values = clampParams(params, rawParams);
	const indicator = indicatorOf(values);
	const cards = MARKS[indicator].cards(count);
	const frame = frameOf(rawParams);
	const size = Math.min(frame.width, frame.height * MARKS[indicator].headroom) * Number(values.fill);
	const stage = { frame, size, gap: Number(values.gap) };
	const step = stepAt(t, cards, Number(values.hold), ease);
	const position = step.index + step.glide;
	const variant = VARIANTS[String(values.variant) as SliderVariant];

	const slides = Array.from({ length: cards }, (_, index) => {
		const slide = variant(centered(index - position, cards), stage);
		return card({ x: slide.x, y: slide.y, z: slide.z }, size * slide.grow, slide.opacity);
	});

	const marks: Record<Indicator, () => Transform[]> = {
		none: () => [],
		dots: () => dots(cards, position, frame),
		bar: () => bar(step.within, frame)
	};

	return [...slides, ...marks[indicator]()];
}
