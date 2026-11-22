import { describe, expect, it } from 'vitest';
import { buildCatalog } from './catalog';
import { loadItems } from './index';

const catalog = buildCatalog();

describe('buildCatalog', () => {
	it('holds every item with its files for the four frameworks', () => {
		expect(catalog.items).toHaveLength(loadItems().length);
		for (const item of catalog.items) {
			for (const framework of ['svelte', 'react', 'vue', 'astro'] as const) {
				expect(item.files[framework].length, `${item.id} ${framework}`).toBeGreaterThan(0);
				expect(item.files[framework].every((file) => file.text.length > 0)).toBe(true);
			}
		}
	});

	it('names the component and the react stylesheet next to it', () => {
		const pricing = catalog.items.find((item) => item.id === 'pricing')!;
		expect(pricing.component).toBe('Pricing');
		expect(pricing.files.react.map((file) => file.name)).toEqual(['Pricing.tsx', 'Pricing.css']);
	});

	it('carries the tokens and a standalone page per item for the thumbnail', () => {
		expect(catalog.tokens).toContain('--feega-bg');
		const pricing = catalog.items.find((item) => item.id === 'pricing')!;
		expect(pricing.page).toContain('<!doctype html>');
		expect(pricing.page).toContain('--feega-bg');
		expect(pricing.page).toContain('fl-pricing');
	});

	it('loads no network resource in the thumbnail page', () => {
		expect(catalog.items.every((item) => !/https?:\/\//.test(item.page.replace(/xmlns="[^"]*"/g, '')))).toBe(true);
	});
});
