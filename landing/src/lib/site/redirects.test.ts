import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import vercel from '../../../vercel.json';
import { COMPARISONS, comparisonPath } from './compare';
import { SITE_PATHS } from './paths';
import { llmsFullTxt } from './llms';

const BLOG_URL = 'https://blog.feega.app/';
const PERMANENT = 301;

type Redirect = { source: string; destination: string; statusCode: number; has?: unknown };

const rules = (vercel.redirects as Redirect[]).filter((r) => !r.has);

const pattern = (source: string) =>
  new RegExp('^' + source.replace(/:(\w+)\*/g, '(?<$1>.*)').replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');

function redirect(path: string): { to: string; status: number } | undefined {
  for (const rule of rules) {
    const hit = pattern(rule.source).exec(path);
    if (!hit) {
      continue;
    }

    const to = rule.destination.replace(/:(\w+)/g, (_, name) => hit.groups?.[name] ?? '');
    return { to, status: rule.statusCode };
  }
}

const OLD_URLS: [string, string][] = [
  ['/blog', '/compare'],
  ['/blog/how-the-canvas-got-fast', `${BLOG_URL}posts/how-the-canvas-got-fast/`],
  ['/blog/an-unknown-post', BLOG_URL],
  ...Object.keys(COMPARISONS).map((slug): [string, string] => [`/blog/feega-vs-${slug}`, comparisonPath(slug)])
];

describe('the old /blog URLs', () => {
  it.each(OLD_URLS)('%s → %s, permanently', (from, to) => {
    expect(redirect(from)).toEqual({ to, status: PERMANENT });
  });

  it.each(OLD_URLS)('%s lands in one hop', (from) => {
    const target = redirect(from)!.to;
    expect(target.startsWith('/') ? redirect(target) : undefined).toBeUndefined();
  });
});

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sourceFiles(join(dir, e.name)) : /\.(ts|svelte|json|html)$/.test(e.name) && !e.name.endsWith('.test.ts') ? [join(dir, e.name)] : []
  );

describe('no page points at a redirected URL', () => {
  it('the sitemap and llms.txt list none', () => {
    expect(SITE_PATHS.filter((p) => redirect(p))).toEqual([]);
    expect(llmsFullTxt()).not.toMatch(/feega\.app\/blog\b/);
  });

  it('no source links to /blog', () => {
    const root = join(__dirname, '../..');
    const linking = sourceFiles(root).filter((f) => /href=["'`]\/blog\b/.test(readFileSync(f, 'utf8')));
    expect(linking).toEqual([]);
  });
});
