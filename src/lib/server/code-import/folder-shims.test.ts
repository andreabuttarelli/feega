import { describe, expect, it } from 'vitest';
import { FolderShim, shimsFor, shimFiles, SHIM_CONFIG } from './folder-shims';

const VITE = { devDependencies: { vite: '^7.0.0' } };
const NEXT = { dependencies: { next: '^16.0.0' } };

const file = (path: string, text: string) => ({ path, text });

describe('a folder that runs outside Next', () => {
  it('gets next/image and next/link shimmed when its code imports them', () => {
    const sources = [file('src/header.tsx', 'import Image from "next/image";\nimport Link from \'next/link\';')];
    expect(shimsFor(sources, VITE)).toEqual([FolderShim.NextImage, FolderShim.NextLink]);
  });

  it('gets nothing shimmed when no file imports next', () => {
    expect(shimsFor([file('src/button.tsx', 'import { motion } from "motion/react";')], VITE)).toEqual([]);
  });

  it('gets the Arc fonts when its tokens ask for Geist or Inter and nothing declares them', () => {
    const sources = [file('src/foundation.css', ':root { --font-display: var(--font-geist, "Geist Variable"), sans-serif; --font-body: var(--font-inter, "Inter Variable"), sans-serif; }')];
    expect(shimsFor(sources, VITE)).toEqual([FolderShim.ArcFonts]);
  });

  it('keeps its own fonts when it declares the Arc font tokens', () => {
    const sources = [file('src/foundation.css', ':root { --font-geist: "My Geist"; --font-display: var(--font-geist, "Geist Variable"); }')];
    expect(shimsFor(sources, VITE)).toEqual([]);
  });
});

describe('a folder that is a Next app or not Vite', () => {
  it('is left alone even when it imports next/image', () => {
    expect(shimsFor([file('app/page.tsx', 'import Image from "next/image";')], { ...VITE, ...NEXT })).toEqual([]);
  });

  it('is left alone when Vite is not its dev server', () => {
    expect(shimsFor([file('src/a.tsx', 'import Image from "next/image";')], { dependencies: { react: '^19.0.0' } })).toEqual([]);
  });
});

describe('the shim files', () => {
  it('wrap the folder config and alias next to plain elements', () => {
    const files = shimFiles([FolderShim.NextImage, FolderShim.NextLink]);
    const config = files.find((f) => f.path === SHIM_CONFIG)!.content;
    expect(config).toContain('loadConfigFromFile');
    expect(config).toContain("'next/image'");
    expect(config).toContain("'next/link'");
    expect(files.map((f) => f.path).sort()).toEqual([SHIM_CONFIG, 'node_modules/.feega/next-image.js', 'node_modules/.feega/next-link.js'].sort());
  });

  it('load Geist and Inter into the page for the Arc fonts', () => {
    const config = shimFiles([FolderShim.ArcFonts]).find((f) => f.path === SHIM_CONFIG)!.content;
    expect(config).toContain('family=Geist');
    expect(config).toContain('family=Inter');
    expect(config).toContain('--font-geist');
  });
});
