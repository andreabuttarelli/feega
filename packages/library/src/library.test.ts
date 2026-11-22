import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from 'svelte/compiler';
import ts from 'typescript';
import {
	CATEGORIES,
	GOOGLE_FONTS,
	ITEMS_DIR,
	PRO_DIR,
	REQUIRED_FRAMEWORKS,
	TOKENS_FILE,
	itemFiles,
	loadItems,
	parseManifest
} from './index';

const freeItems = loadItems();
const proItems = loadItems(PRO_DIR);
const items = [...freeItems, ...proItems];
const tokens = readFileSync(TOKENS_FILE, 'utf8');
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/;
const PALETTE_TABLES: Readonly<Record<string, RegExp>> = {
	'ascii-pride': /--ascii-c\d+:#[0-9a-fA-F]{6}\b/g,
	'smear-gradient': /--smear-c\d+:#[0-9a-fA-F]{6}\b/g
};
const withoutPalette = (id: string, source: string) => (id in PALETTE_TABLES ? source.replace(PALETTE_TABLES[id], '') : source);
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
	fonts: [{ family: 'Inter Tight', weights: [400] }],
	tier: 'free'
};
const FONT_FAMILIES = /--feega-font(?:-[a-z]+)?:\s*([^;]+);/g;
const FAMILY_NAME = /"([^"]+)"/g;
const SYSTEM_FAMILIES = ['SF Mono', 'Segoe UI', 'Helvetica Neue'];
const SANS = 'Inter Tight';
const MONO = 'Fragment Mono';
const AA = 4.5;
const CONTRAST_PAIRS = [
	['accent', 'accent-fg'],
	['accent-hover', 'accent-fg'],
	['danger', 'danger-fg'],
	['accent-soft', 'accent-text'],
	['success-soft', 'success'],
	['danger-soft', 'danger'],
	['raised', 'fg-subtle']
];

function tokenFamilies(): string[] {
	return [...tokens.matchAll(FONT_FAMILIES)].flatMap((m) => [...m[1].matchAll(FAMILY_NAME)].map((f) => f[1]));
}

function themes(): Record<string, string>[] {
	return tokens
		.split(/@media|\[data-theme="dark"\] {/)
		.map((block) => Object.fromEntries([...block.matchAll(/--feega-([a-z-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]])));
}

function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5]
		.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

describe('library items', () => {
	it('ships about sixty items', () => {
		expect(items.length).toBeGreaterThanOrEqual(60);
	});

	it('has one folder per manifest id', () => {
		expect(freeItems.map((item) => item.id).sort()).toEqual(readdirSync(ITEMS_DIR).sort());
		expect(proItems.map((item) => item.id).sort()).toEqual(readdirSync(PRO_DIR).sort());
	});

	it('keeps free items in items/ and pro items apart in pro/', () => {
		expect(freeItems.every((item) => item.tier === 'free')).toBe(true);
		expect(proItems.length).toBeGreaterThan(0);
		expect(proItems.every((item) => item.tier === 'pro')).toBe(true);
	});

	it('keeps nothing but the manifest and the preview of a pro item in the public repo', () => {
		for (const item of proItems) {
			expect(readdirSync(join(PRO_DIR, item.id)).sort(), item.id).toEqual(['manifest.json', 'preview.webp']);
		}
	});

	it('requires a valid manifest', () => {
		expect(parseManifest(VALID_MANIFEST).id).toBe('x');
		expect(() => parseManifest({})).toThrow();
		expect(() => parseManifest({ ...VALID_MANIFEST, category: 'nope' })).toThrow();
		expect(() => parseManifest({ ...VALID_MANIFEST, tier: 'paid' })).toThrow();
		expect(parseManifest({ ...VALID_MANIFEST, tier: 'pro' }).tier).toBe('pro');
		expect(parseManifest({ ...VALID_MANIFEST, preview: 'https://example.com/x.png' }).preview).toBe('https://example.com/x.png');
		expect(() => parseManifest({ ...VALID_MANIFEST, preview: 3 })).toThrow();
		expect(() => parseManifest({ ...VALID_MANIFEST, frameworks: ['html'] })).toThrow();
		expect(() => parseManifest({ ...VALID_MANIFEST, fonts: undefined })).toThrow();
		expect(() => parseManifest({ ...VALID_MANIFEST, fonts: [{ family: 'BDO Grotesk', weights: [400] }] })).toThrow();
		expect(() => parseManifest({ ...VALID_MANIFEST, fonts: [{ family: SANS, weights: [] }] })).toThrow();
	});

	it('allows colour literals only in a declared palette table', () => {
		expect(COLOR_LITERAL.test(withoutPalette('ascii-pride', '--ascii-c1:#E40303;'))).toBe(false);
		expect(COLOR_LITERAL.test(withoutPalette('ascii-pride', '--ascii-c1:#E40303;color:#fff'))).toBe(true);
		expect(COLOR_LITERAL.test(withoutPalette('card', '--ascii-c1:#E40303;'))).toBe(true);
	});

	it('covers every category', () => {
		for (const category of CATEGORIES) {
			expect(items.some((item) => item.category === category)).toBe(true);
		}
	});

	for (const item of freeItems) {
		describe(item.id, () => {
			it('is dependency free and in every required framework', () => {
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
						const source = withoutPalette(item.id, readFileSync(file, 'utf8'));
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

			it('lists every font family it renders', () => {
				const families = item.fonts.map((font) => font.family);
				const source = readFileSync(itemFiles(item, 'html')[1], 'utf8');
				expect(families).toContain(SANS);
				expect(families.includes(MONO)).toBe(source.includes('--feega-font-mono'));
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
	it('uses only Google Fonts families or system stacks', () => {
		const families = new Set(tokenFamilies().filter((family) => !SYSTEM_FAMILIES.includes(family)));
		expect([...families].sort()).toEqual([...GOOGLE_FONTS].sort());
	});

	it('reaches AA contrast for text on fills, in both themes', () => {
		for (const theme of themes()) {
			for (const [bg, fg] of CONTRAST_PAIRS) {
				expect(contrast(theme[bg], theme[fg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(AA);
			}
		}
	});

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
