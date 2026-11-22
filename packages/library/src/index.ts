import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRAMEWORKS = ['html', 'svelte', 'react', 'vue', 'astro'] as const;
export const REQUIRED_FRAMEWORKS = ['svelte', 'react', 'vue', 'astro'] as const;
export const CATEGORIES = ['section', 'component', 'app'] as const;

export type Framework = (typeof FRAMEWORKS)[number];
export const TIERS = ['free', 'pro'] as const;

export const GOOGLE_FONTS = ['Inter Tight', 'Fragment Mono'] as const;

export type GoogleFont = (typeof GOOGLE_FONTS)[number];

export interface FontNeed {
	family: GoogleFont;
	weights: number[];
}

export type Category = (typeof CATEGORIES)[number];
export type Tier = (typeof TIERS)[number];

export interface LibraryItem {
	id: string;
	name: string;
	description: string;
	category: Category;
	tags: string[];
	frameworks: Framework[];
	dependencies: string[];
	fonts: FontNeed[];
	tier: Tier;
	preview?: string;
}

const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ITEMS_DIR = join(PACKAGE_DIR, 'items');
export const TOKENS_FILE = join(PACKAGE_DIR, 'tokens.css');

function isFontList(value: unknown): value is FontNeed[] {
	return (
		Array.isArray(value) &&
		value.every(
			(font) =>
				GOOGLE_FONTS.includes(font?.family) &&
				Array.isArray(font.weights) &&
				font.weights.length > 0 &&
				font.weights.every((weight: unknown) => Number.isInteger(weight))
		)
	);
}

function isStringList(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function parseManifest(raw: unknown): LibraryItem {
	const m = raw as Partial<Record<keyof LibraryItem, unknown>>;
	const valid =
		typeof m?.id === 'string' &&
		typeof m.name === 'string' &&
		typeof m.description === 'string' &&
		CATEGORIES.includes(m.category as Category) &&
		isStringList(m.tags) &&
		isStringList(m.frameworks) &&
		m.frameworks.every((f) => FRAMEWORKS.includes(f as Framework)) &&
		REQUIRED_FRAMEWORKS.every((f) => (m.frameworks as string[]).includes(f)) &&
		isStringList(m.dependencies) &&
		isFontList(m.fonts) &&
		TIERS.includes(m.tier as Tier) &&
		(m.preview === undefined || typeof m.preview === 'string');
	if (!valid) {
		throw new Error(`Invalid library manifest: ${JSON.stringify(raw)}`);
	}
	return m as LibraryItem;
}

export function loadItems(itemsDir: string = ITEMS_DIR): LibraryItem[] {
	return readdirSync(itemsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => JSON.parse(readFileSync(join(itemsDir, entry.name, 'manifest.json'), 'utf8')))
		.map(parseManifest)
		.sort((a, b) => a.id.localeCompare(b.id));
}

export function componentName(id: string): string {
	return id
		.split('-')
		.map((part) => part[0].toUpperCase() + part.slice(1))
		.join('');
}

export function itemFiles(item: LibraryItem, framework: Framework, itemsDir: string = ITEMS_DIR): string[] {
	const dir = join(itemsDir, item.id, framework);
	const name = componentName(item.id);
	const byFramework: Record<Framework, string[]> = {
		html: ['index.html', 'style.css'],
		svelte: [`${name}.svelte`],
		react: [`${name}.tsx`, `${name}.css`],
		vue: [`${name}.vue`],
		astro: [`${name}.astro`]
	};
	return byFramework[framework].map((file) => join(dir, file));
}
