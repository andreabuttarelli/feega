import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EDITOR_SHOTS, EditorShotId } from './editor-shots';

const SRC = resolve(import.meta.dirname, '../..');
const STATIC_DIR = resolve(SRC, '../static');
const EDITOR_DIR = resolve(STATIC_DIR, 'img/editor');
const HOME_HERO = 'lib/site/home/Hero.svelte';
const MIN_ALT = 40;
type Manifest = { shots: Record<string, { page: string; files: string[] }> };

const manifest: Manifest = JSON.parse(readFileSync(resolve(EDITOR_DIR, 'manifest.json'), 'utf8'));
const basename = (src: string) => src.split('/').at(-1)!;

const MOCKUP_IMPORT = ['EditorMock', 'svelte'].join('.');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe('editor screenshots', () => {
  it.each(Object.entries(EDITOR_SHOTS))('%s ships a desktop file, a narrow crop and alt text', (_, shot) => {
    expect(existsSync(resolve(STATIC_DIR, shot.src.slice(1))), shot.src).toBe(true);
    expect(existsSync(resolve(STATIC_DIR, shot.narrow.src.slice(1))), shot.narrow.src).toBe(true);
    expect(shot.alt.length).toBeGreaterThan(MIN_ALT);
  });

  it('the programmed editor mockup stays on the home page only', () => {
    const users = sourceFiles(SRC)
      .filter((file) => /\.(svelte|ts)$/.test(file) && readFileSync(file, 'utf8').includes(MOCKUP_IMPORT))
      .map((file) => relative(SRC, file));
    expect(users).toEqual([HOME_HERO]);
  });

  it.each(Object.values(EditorShotId))('%s lists its files and a demo page in the manifest', (id) => {
    const entry = manifest.shots[id];
    expect(entry, id).toBeDefined();
    expect(entry.files).toContain(basename(EDITOR_SHOTS[id].src));
    expect(entry.files).toContain(basename(EDITOR_SHOTS[id].narrow.src));
  });

  it('no demo page appears in two different shots', () => {
    const pages = Object.values(manifest.shots).map((entry) => entry.page);
    expect(new Set(pages).size).toBe(pages.length);
  });

  it('no image sits in the folder without a manifest entry', () => {
    const listed = Object.values(manifest.shots).flatMap((entry) => entry.files);
    const onDisk = readdirSync(EDITOR_DIR).filter((name) => name.endsWith('.webp'));
    expect(onDisk.sort()).toEqual(listed.sort());
  });
});
