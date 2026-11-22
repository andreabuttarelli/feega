import tokensCss from '../../../../../packages/library/tokens.css?raw';
import { Framework, Tier, type CodeFile, type FrameworkCode, type Template } from './template';

const FILES = import.meta.glob<string>('../../../../../packages/library/items/*/*/*', { query: '?raw', import: 'default' });

const PREFIX = '../../../../../packages/library/items/';

export const TOKENS_CSS: string = tokensCss;

const FILE_ORDER = ['.svelte', '.vue', '.astro', '.tsx', '.html', '.css'];

const rank = (name: string) => FILE_ORDER.findIndex((ext) => name.endsWith(ext));

async function filesOf(id: string, framework: Framework): Promise<readonly CodeFile[]> {
  const dir = `${PREFIX}${id}/${framework}/`;
  const names = Object.keys(FILES).filter((path) => path.startsWith(dir));
  const files = await Promise.all(names.map(async (path) => ({ name: path.slice(dir.length), code: await FILES[path]() })));

  return files.sort((a, b) => rank(a.name) - rank(b.name));
}

export async function codeOf(template: Template): Promise<FrameworkCode> {
  const frameworks = Object.values(Framework);
  const lists = await Promise.all(frameworks.map((f) => (template.tier === Tier.Pro ? [] : filesOf(template.id, f))));

  return Object.fromEntries(frameworks.map((f, i) => [f, lists[i]])) as FrameworkCode;
}

export async function previewParts(id: string): Promise<{ markup: string; css: string }> {
  const [markup, css] = await Promise.all(['index.html', 'style.css'].map((name) => FILES[`${PREFIX}${id}/html/${name}`]()));

  return { markup, css };
}
