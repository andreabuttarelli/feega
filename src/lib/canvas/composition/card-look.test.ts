import { describe, expect, it } from 'vitest';
import { CellFit } from '$lib/motion/bento/model';
import { CARD_ASPECTS, ORIGINAL, aspectValue, cardBox, cardParams, lookOf } from './card-look';

describe('card aspect', () => {
	it('names every ratio a user can pick', () => {
		expect(CARD_ASPECTS).toEqual(['original', '1:1', '4:5', '9:16', '16:9', '3:4', 'free']);
	});

	it('turns a named ratio into width over height, and free into the chosen number', () => {
		expect(aspectValue('4:5', 1)).toBeCloseTo(0.8);
		expect(aspectValue('16:9', 1)).toBeCloseTo(16 / 9);
		expect(aspectValue('free', 2.35)).toBeCloseTo(2.35);
		expect(aspectValue('original', 2)).toBe(ORIGINAL);
	});

	it('fits a card of any ratio inside the square the layout poses', () => {
		expect(cardBox(1)).toEqual([1, 1]);
		expect(cardBox(16 / 9)).toEqual([1, 9 / 16]);
		expect(cardBox(0.8)).toEqual([0.8, 1]);
		expect(cardBox(ORIGINAL)).toEqual([1, 1]);
	});

	it('takes the card override first, then the layout default', () => {
		const params = { cardAspect: '4:5', cardRatio: 1 };

		expect(lookOf({}, params).aspect).toBeCloseTo(0.8);
		expect(lookOf({ aspect: '16:9' }, params).aspect).toBeCloseTo(16 / 9);
		expect(lookOf({ aspect: 'free', ratio: 1.5 }, params).aspect).toBeCloseTo(1.5);
		expect(lookOf({ aspect: 'original' }, params).aspect).toBe(ORIGINAL);
	});

	it('keeps the crop of the card: cover by default, contain and focus when asked', () => {
		expect(lookOf({}, {})).toMatchObject({ fit: 0, focusX: 0.5, focusY: 0.5 });
		expect(lookOf({ fit: CellFit.Contain, focusX: 0.2, focusY: 0.9 }, {})).toMatchObject({ fit: 1, focusX: 0.2, focusY: 0.9 });
	});

	it('gives each layout its own default ratio as a template setting', () => {
		const [aspect, ratio] = cardParams('original');

		expect(aspect).toMatchObject({ name: 'cardAspect', kind: 'select', default: 'original' });
		expect(ratio).toMatchObject({ name: 'cardRatio', kind: 'range' });
	});
});
