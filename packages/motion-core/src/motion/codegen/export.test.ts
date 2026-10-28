import { describe, expect, it } from 'vitest';
import { parseMotionDoc } from '../doc';
import { CodeTarget, exportCode, type CodeExport } from './index';
import { absoluteDoc, featureGridDoc, heroDoc } from './fixtures/small';
import { landingDoc, LANDING_ASSETS } from './fixtures/landing';

const file = (out: CodeExport, path: string) => {
  const found = out.files.find((f) => f.path === path);
  if (!found) {
    throw new Error(`${path} is not in ${out.files.map((f) => f.path).join(', ')}`);
  }
  return found.content;
};

describe('a hero with a nav and button instances', () => {
  const react = exportCode(heroDoc(), { name: 'Landing' });

  it('is a React project with one file per component', () => {
    expect(react.files.map((f) => f.path)).toEqual([
      'README.md',
      'index.html',
      'package.json',
      'src/components/Button.tsx',
      'src/index.css',
      'src/lib/cx.ts',
      'src/main.tsx',
      'src/pages/Landing.tsx',
      'src/tokens.css',
      'tsconfig.json',
      'vite.config.ts'
    ]);
  });

  it('turns the instance text that differs into a typed prop', () => {
    const button = file(react, 'src/components/Button.tsx');
    expect(button).toContain('label?: string;');
    expect(button).toContain('export function Button({ label = "Get started", className }: ButtonProps)');
    expect(button).toContain('<button className={cx(');
    expect(button).toContain('type="button"');
    expect(button).toContain('{label}');
  });

  it('places instances with only the values that differ', () => {
    const page = file(react, 'src/pages/Landing.tsx');
    expect(page).toContain("import { Button } from '../components/Button';");
    expect(page).toContain('label="Start free"');
    expect(page).toContain('label="Book a demo"');
    expect(page).toMatch(/<Button[^>]*\/>/);
    expect(page.match(/<Button /g)).toHaveLength(3);
  });

  it('maps auto layout to flex with gap and padding', () => {
    const page = file(react, 'src/pages/Landing.tsx');
    expect(page).toMatch(/<main className="[^"]*flex flex-col/);
    expect(page).toContain('gap-16');
    expect(page).toContain('justify-between');
    expect(page).not.toContain('absolute');
  });

  it('picks semantic tags from layer names and type size', () => {
    const page = file(react, 'src/pages/Landing.tsx');
    expect(page).toContain('<nav ');
    expect(page).toContain('<section ');
    expect(page).toMatch(/<h1 [^>]*>\s*Ship the release notes\s*<br \/>\s*your customers read\s*<\/h1>/);
    expect(page).toContain('<p className=');
  });

  it('writes the document colours and fonts as tokens', () => {
    const tokens = file(react, 'src/tokens.css');
    expect(tokens).toContain('@theme {');
    expect(tokens).toContain('--font-inter: "Inter"');
    expect(tokens).toContain('--color-accent: #4f46e5;');
    expect(file(react, 'src/components/Button.tsx')).toContain('bg-accent');
  });

  it('is deterministic', () => {
    expect(exportCode(heroDoc(), { name: 'Landing' })).toEqual(react);
  });
});

describe('a feature grid of card instances', () => {
  it('becomes a CSS grid with a card component whose title and body are props', () => {
    const react = exportCode(featureGridDoc(), { name: 'Features' });
    const card = file(react, 'src/components/FeatureCard.tsx');
    expect(card).toContain('title?: string;');
    expect(card).toContain('body?: string;');
    expect(card).toContain('<article ');
    expect(card).toContain('<svg ');
    expect(file(react, 'src/pages/Features.tsx')).toContain('grid grid-cols-3');
  });

  it('exports plain HTML with a stylesheet per component', () => {
    const html = exportCode(featureGridDoc(), { name: 'Features', target: CodeTarget.Html });
    const index = file(html, 'index.html');
    expect(index).toContain('<article class="feature-card">');
    expect(index).toContain('Schemas catch a missing field before the deploy does.');
    expect(index).toContain('href="styles/components/feature-card.css"');
    expect(file(html, 'styles/components/feature-card.css')).toContain('.feature-card__title {');
    expect(file(html, 'styles/page.css')).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(file(html, 'styles/tokens.css')).toContain(':root {');
  });

  it('exports Svelte components with $props', () => {
    const svelte = exportCode(featureGridDoc(), { name: 'Features', target: CodeTarget.Svelte });
    const card = file(svelte, 'src/lib/components/FeatureCard.svelte');
    expect(card).toContain('let { title = "Fast by default", body = "Every page is static until it needs not to be.", class: className = \'\' }: Props = $props();');
    expect(card).toContain('<h3 class="title">{title}</h3>');
    expect(card).toContain('<style>');
    expect(file(svelte, 'src/routes/+page.svelte')).toMatch(/import FeatureCard from '.lib\/components\/FeatureCard\.svelte';/);
  });
});

describe('instances that do not differ', () => {
  it('produce no props', () => {
    const doc = featureGridDoc();
    const host = doc.tracks.flatMap((t) => t.clips).filter((c) => c.component === 'Precomp');
    host.forEach((c) => delete (c.props as { overrides?: unknown }).overrides);
    const card = file(exportCode(doc, { name: 'Features' }), 'src/components/FeatureCard.tsx');
    expect(card).toContain('export type FeatureCardProps = {\n  className?: string;\n};');
  });
});

describe('a frame without auto layout', () => {
  it('positions its layers absolutely inside a relative parent', () => {
    const css = file(exportCode(absoluteDoc(), { name: 'Poster', target: CodeTarget.Html }), 'styles/page.css');
    expect(css).toContain('position: relative;');
    expect(css).toMatch(/\.badge \{\n {2}position: absolute;\n {2}left: 600px;\n {2}width: 160px;\n {2}top: 40px;\n {2}height: 48px;/);
  });
});

describe('the landing page fixture', () => {
  it('is a valid design', () => {
    expect(parseMotionDoc(landingDoc()).ok).toBe(true);
  });

  it('exports every section through components', () => {
    const react = exportCode(landingDoc(), { name: 'Landing', assets: LANDING_ASSETS });
    const components = react.files.filter((f) => f.path.startsWith('src/components/')).map((f) => f.path);
    expect(components.length).toBeGreaterThanOrEqual(5);
    const page = file(react, 'src/pages/Landing.tsx');
    expect(page.match(/<h1 /g)).toHaveLength(1);
    expect(page).toContain('<footer ');
    expect(page).toContain('grid-cols-12');
  });
});
