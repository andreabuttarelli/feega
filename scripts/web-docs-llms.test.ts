import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { llmsFullTxt, llmsTxt, pageUrl } from '../web-docs/src/lib/llms.js';

type DocPage = { id: string; title: string; description: string; body: string };

const DOCS_DIR = join(__dirname, '../web-docs/src/content/docs');

const markdownFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? markdownFiles(join(dir, e.name)) : /\.mdx?$/.test(e.name) ? [join(dir, e.name)] : []));

const frontmatterField = (source: string, field: string) => source.match(new RegExp(`^${field}: (.*)$`, 'm'))?.[1] ?? '';

const docPages = (): DocPage[] =>
  markdownFiles(DOCS_DIR).map((file) => {
    const source = readFileSync(file, 'utf8');
    return {
      id: relative(DOCS_DIR, file).replace(/\.mdx?$/, ''),
      title: frontmatterField(source, 'title'),
      description: frontmatterField(source, 'description'),
      body: source.replace(/^---[\s\S]*?---\n/, '')
    };
  });

describe('llms.txt', () => {
  const pages = docPages();

  it('lists every docs page with its link', () => {
    const txt = llmsTxt(pages);
    for (const p of pages) {
      expect(txt, p.id).toContain(`(${pageUrl(p.id)})`);
    }
  });

  it('puts every docs page in llms-full.txt', () => {
    const full = llmsFullTxt(pages);
    for (const p of pages) {
      expect(full, p.id).toContain(`${pageUrl(p.id)}\n`);
    }
  });

  it('links the website, GitHub and both skill installs', () => {
    const txt = llmsTxt(pages);
    expect(txt).toContain('https://www.feega.app');
    expect(txt).toContain('https://github.com/andreabuttarelli/feega');
    expect(txt).toContain('npx skills add andreabuttarelli/feega');
    expect(txt).toContain('/plugin install feega --marketplace andreabuttarelli/feega');
  });
});
