import { describe, expect, it } from 'vitest';
import { EFFECTS } from './index';
import { effectsCatalogue } from './catalogue';

describe('effectsCatalogue', () => {
	it('lists every effect of the table with its params, nothing more', () => {
		const catalogue = effectsCatalogue();

		expect(catalogue.map((effect) => effect.id).sort()).toEqual(Object.keys(EFFECTS).sort());
		for (const effect of catalogue) {
			expect(effect.label).toBe(EFFECTS[effect.id].label);
			expect(effect.params).toEqual(EFFECTS[effect.id].params);
		}
	});
});
