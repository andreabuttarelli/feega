import { CellFit } from '../../motion/bento/model';
import type { LayoutParam, LayoutParams } from './types';

export const CARD_ASPECTS = ['original', '1:1', '4:5', '9:16', '16:9', '3:4', 'free'] as const;
export type CardAspect = (typeof CARD_ASPECTS)[number];

export const ORIGINAL = 0;
export const RATIO_RANGE = { min: 0.25, max: 4 } as const;
export const LOOK_FIELDS = 5;

const NAMED: Record<CardAspect, (ratio: number) => number> = {
	original: () => ORIGINAL,
	'1:1': () => 1,
	'4:5': () => 4 / 5,
	'9:16': () => 9 / 16,
	'16:9': () => 16 / 9,
	'3:4': () => 3 / 4,
	free: (ratio) => Math.min(RATIO_RANGE.max, Math.max(RATIO_RANGE.min, ratio))
};

const FIT_CODE: Record<CellFit, number> = { [CellFit.Cover]: 0, [CellFit.Contain]: 1 };
const CENTRE = 0.5;

export type CardShape = { aspect?: CardAspect; ratio?: number; fit?: CellFit; focusX?: number; focusY?: number };
export type CardLook = { aspect: number; fit: number; focusX: number; focusY: number; solid: number };

export function aspectValue(aspect: CardAspect, ratio: number): number {
	return NAMED[aspect](ratio);
}

export function cardBox(aspect: number): [number, number] {
	if (!(aspect > 0)) {
		return [1, 1];
	}
	return aspect >= 1 ? [1, 1 / aspect] : [aspect, 1];
}

export function cardParams(fallback: CardAspect): LayoutParam[] {
	return [
		{ name: 'cardAspect', label: 'Card ratio', kind: 'select', options: CARD_ASPECTS.map((value) => ({ value, label: value })), default: fallback },
		{ name: 'cardRatio', label: 'Free ratio (width / height)', kind: 'range', min: RATIO_RANGE.min, max: RATIO_RANGE.max, step: 0.01, default: 1 }
	];
}

function isAspect(value: unknown): value is CardAspect {
	return CARD_ASPECTS.includes(value as CardAspect);
}

export function lookOf(card: CardShape, params: LayoutParams): CardLook {
	const layoutAspect = isAspect(params.cardAspect) ? params.cardAspect : '1:1';
	const layoutRatio = Number(params.cardRatio ?? 1);
	const aspect = card.aspect ? aspectValue(card.aspect, card.ratio ?? layoutRatio) : aspectValue(layoutAspect, layoutRatio);

	return {
		aspect,
		fit: FIT_CODE[card.fit ?? CellFit.Cover],
		focusX: card.focusX ?? CENTRE,
		focusY: card.focusY ?? CENTRE,
		solid: 0
	};
}

export const SOLID_LOOK: CardLook = { aspect: 1, fit: 0, focusX: CENTRE, focusY: CENTRE, solid: 1 };
