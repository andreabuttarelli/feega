import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { compile } from 'svelte/compiler';
import ts from 'typescript';
import {
	CATEGORIES,
	ITEMS_DIR,
	REQUIRED_FRAMEWORKS,
	TOKENS_FILE,
	itemFiles,
	loadItems,
	parseManifest
} from './index';

const items = loadItems();
const tokens = readFileSync(TOKENS_FILE, 'utf8');
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/;
const NAMED_COLOR =
	/(?:^|[;{\s])(?:color|background(?:-color)?|border(?:-[a-z]+)?-color|border|outline|fill|stroke)\s*:\s*[^;}]*\b(?:white|black|red|green|blue|gray|grey|orange|purple|yellow)\b/;
const TOKEN_REF = /var\(\s*(--feega-[a-z0-9-]+)/g;
const VALID_MANIFEST = {
	id: 'x',
	name: 'X',
	description: 'd',
	category: 'section',
	tags: [],
	frameworks: ['svelte', 'react', 'vue', 'astro'],
	dependencies: [],
	tier: 'free'
};

describe('library items', () => {
	it('ships about twenty items', () => {
		expect(items.length).toBeGreaterThanOrEqual(20);
	});

	it('has one folder per manifest id', () => {
		const folders = readdirSync(ITEMS_DIR).sort();
		expect(items.map((item) => item.id).sort()).toEqual(folders);
	});

	it('requires a valid manifest', () => {
		expect(parseManifest(VALID_MANIFEST).id).toBe('x');
		expect(() => parseManifest({})).toThrow();
		expect(() => parseManifest({ ...VALID_MANIFEST, category: 'nope' })).toThrow();
		expect(() => parseManifest({ ...VALID_MANIFEST, tier: 'paid' })).toThrow();
		expect(() => parseManifest({ ...VALID_MANIFEST, frameworks: ['html'] })).toThrow();
	});

	it('covers every category', () => {
		for (const category of CATEGORIES) {
			expect(items.some((item) => item.category === category)).toBe(true);
		}
	});

	for (const item of items) {
		describe(item.id, () => {
			it('is free, dependency free and in every required framework', () => {
				expect(item.tier).toBe('free');
				expect(item.dependencies).toEqual([]);
				for (const framework of REQUIRED_FRAMEWORKS) {
					expect(item.frameworks).toContain(framework);
				}
			});

			it('has every declared framework file', () => {
				for (const framework of item.frameworks) {
					for (const file of itemFiles(item, framework)) {
						expect(existsSync(file), file).toBe(true);
					}
				}
			});

			it('uses only tokens for colour', () => {
				for (const framework of item.frameworks) {
					for (const file of itemFiles(item, framework)) {
						const source = readFileSync(file, 'utf8');
						expect(COLOR_LITERAL.test(source), file).toBe(false);
						expect(NAMED_COLOR.test(source), file).toBe(false);
					}
				}
			});

			it('references only declared tokens', () => {
				for (const framework of item.frameworks) {
					for (const file of itemFiles(item, framework)) {
						const source = readFileSync(file, 'utf8');
						for (const match of source.matchAll(TOKEN_REF)) {
							expect(tokens.includes(`${match[1]}:`), `${match[1]} in ${file}`).toBe(true);
						}
					}
				}
			});

			it('has a compiling svelte component', () => {
				const file = itemFiles(item, 'svelte').find((f) => f.endsWith('.svelte'))!;
				expect(() => compile(readFileSync(file, 'utf8'), { filename: file })).not.toThrow();
			});

			it('has a vue single-file component with template and style', () => {
				const source = readFileSync(itemFiles(item, 'vue')[0], 'utf8');
				expect(source).toContain('<template>');
				expect(source).toContain('<style');
				if (source.includes('<script')) {
					expect(source).toContain('<script setup lang="ts">');
				}
			});

			it('has an astro component with a frontmatter fence and style', () => {
				const source = readFileSync(itemFiles(item, 'astro')[0], 'utf8');
				expect(source).toMatch(/^---\n(?:[\s\S]*?\n)?---\n/);
				expect(source).toContain('<style');
			});

			it('has a parsing react component', () => {
				const file = itemFiles(item, 'react').find((f) => f.endsWith('.tsx'))!;
				const result = ts.transpileModule(readFileSync(file, 'utf8'), {
					fileName: file,
					reportDiagnostics: true,
					compilerOptions: { jsx: ts.JsxEmit.ReactJSX }
				});
				expect(result.diagnostics).toEqual([]);
			});
		});
	}
});

describe('tokens.css', () => {
	it('declares a light and a dark theme', () => {
		expect(tokens).toContain('[data-theme="dark"]');
		expect(tokens).toContain('prefers-color-scheme: dark');
	});

	it('declares the full token set', () => {
		const names = ['bg', 'surface', 'raised', 'fg', 'fg-muted', 'line', 'accent', 'accent-fg', 'accent-soft', 'danger', 'success', 'focus', 'radius-sm', 'radius-md', 'radius-lg', 'radius-full', 'font', 'font-mono', 'shadow'];
		for (const name of names) {
			expect(tokens.includes(`--feega-${name}:`), name).toBe(true);
		}
	});
});
