import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ITEMS_DIR, TOKENS_FILE, componentName, itemFiles, loadItems, type Framework, type LibraryItem } from './index';

export const CATALOG_FRAMEWORKS = ['svelte', 'react', 'vue', 'astro'] as const;

export type CatalogFramework = (typeof CATALOG_FRAMEWORKS)[number];

export type CatalogFile = { name: string; text: string };

export interface CatalogItem extends LibraryItem {
	component: string;
	files: Record<CatalogFramework, CatalogFile[]>;
	page: string;
}

export interface Catalog {
	tokens: string;
	items: CatalogItem[];
}

const read = (path: string) => readFileSync(path, 'utf8');

const filesOf = (item: LibraryItem, framework: Framework, itemsDir: string): CatalogFile[] =>
	itemFiles(item, framework, itemsDir).map((path) => ({ name: path.slice(path.lastIndexOf('/') + 1), text: read(path) }));

const pageOf = (tokens: string, item: LibraryItem, itemsDir: string): string => {
	const dir = join(itemsDir, item.id, 'html');
	return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${tokens}\n${read(join(dir, 'style.css'))}\nbody{margin:0;background:var(--feega-bg)}</style></head><body>${read(join(dir, 'index.html'))}</body></html>`;
};

export function buildCatalog(itemsDir: string = ITEMS_DIR, tokensFile: string = TOKENS_FILE): Catalog {
	const tokens = read(tokensFile);
	const items = loadItems(itemsDir).map((item) => ({
		...item,
		component: componentName(item.id),
		files: Object.fromEntries(CATALOG_FRAMEWORKS.map((framework) => [framework, filesOf(item, framework, itemsDir)])) as CatalogItem['files'],
		page: pageOf(tokens, item, itemsDir)
	}));
	return { tokens, items };
}
