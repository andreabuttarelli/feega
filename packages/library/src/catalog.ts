import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ITEMS_DIR, PREVIEW_FILE, TOKENS_FILE, componentName, itemFiles, loadItems, type Framework, type LibraryItem } from './index';

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

const noFiles = () => Object.fromEntries(CATALOG_FRAMEWORKS.map((framework) => [framework, []])) as unknown as CatalogItem['files'];

const lockedPageOf = (item: LibraryItem, proDir: string): string => {
	const image = readFileSync(join(proDir, item.id, PREVIEW_FILE)).toString('base64');
	return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;height:100%}img{display:block;width:100%;height:100%;object-fit:cover}</style></head><body><img alt="" src="data:image/webp;base64,${image}"></body></html>`;
};

export function buildCatalog(itemsDir: string = ITEMS_DIR, tokensFile: string = TOKENS_FILE, proDir: string = join(itemsDir, '..', 'pro')): Catalog {
	const tokens = read(tokensFile);
	const free = loadItems(itemsDir).map((item) => ({
		...item,
		component: componentName(item.id),
		files: Object.fromEntries(CATALOG_FRAMEWORKS.map((framework) => [framework, filesOf(item, framework, itemsDir)])) as CatalogItem['files'],
		page: pageOf(tokens, item, itemsDir)
	}));
	const pro = loadItems(proDir).map((item) => ({ ...item, component: componentName(item.id), files: noFiles(), page: lockedPageOf(item, proDir) }));
	return { tokens, items: [...free, ...pro] };
}
