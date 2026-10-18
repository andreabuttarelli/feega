// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaAccept, MediaKind, type MediaPick } from '$lib/motion/media/pick';
import type { MediaSource, MediaUploader } from './media-upload';
import MediaPicker from './MediaPicker.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount, tick } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

const LIBRARY = [
  { id: 'sunset', kind: 'image', label: 'Sunset beach', previewUrl: '/a/sunset' },
  { id: 'city', kind: 'image', label: 'City night', previewUrl: '/a/city' },
  { id: 'clip', kind: 'video', label: 'Drone clip', previewUrl: '/a/clip', seconds: 12 }
];

let app: Record<string, unknown> | null = null;

function show(props: { value?: MediaPick | null; accept?: MediaAccept; uploader?: MediaUploader }) {
  const onpick = vi.fn();
  app = mount(MediaPicker, { target: document.body, props: { value: null, assets: LIBRARY, label: 'Picture', onpick, ...props } });
  flushSync();
  return onpick;
}

const byId = <T extends HTMLElement>(id: string) => document.querySelector<T>(`[data-testid="${id}"]`)!;
const all = (id: string) => [...document.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)];
const click = (el: HTMLElement) => {
  el.click();
  flushSync();
};
const type = (el: HTMLInputElement, value: string) => {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
};

describe('the media picker', () => {
  afterEach(() => {
    if (app) {
      unmount(app);
    }
    app = null;
    document.body.innerHTML = '';
  });

  it('never asks for an id or a link', () => {
    show({});
    expect(document.body.textContent?.toLowerCase()).not.toContain('id or link');
  });

  it('shows an empty state, then the current picture as a thumbnail', () => {
    show({});
    expect(byId('media-empty')).toBeTruthy();
    unmount(app!);
    show({ value: { kind: MediaKind.Image, assetId: 'city' } });
    expect(byId('media-preview').querySelector('img')?.getAttribute('src')).toBe('/a/city');
  });

  it('shows a video as its first frame and its duration', () => {
    show({ value: { kind: MediaKind.Video, assetId: 'clip' }, accept: MediaAccept.Any });
    expect(byId('media-preview').querySelector('video')?.getAttribute('src')).toContain('/a/clip');
    expect(byId('media-duration').textContent).toBe('0:12');
  });

  it('picks from the library, with search, only the kinds the slot takes', () => {
    const onpick = show({ accept: MediaAccept.Image });
    click(byId('media-add'));
    click(byId('media-tab-library'));
    expect(all('media-library-item')).toHaveLength(2);
    type(byId('media-search'), 'city');
    expect(all('media-library-item')).toHaveLength(1);
    click(all('media-library-item')[0]);
    expect(onpick).toHaveBeenLastCalledWith({ kind: MediaKind.Image, assetId: 'city' });
  });

  it('removes the current media', () => {
    const onpick = show({ value: { kind: MediaKind.Image, assetId: 'city' } });
    click(byId('media-remove'));
    expect(onpick).toHaveBeenLastCalledWith(null);
  });

  it('validates a link, previews it, then copies it into the project as an asset', async () => {
    const uploader = vi.fn(async () => ({ ok: true as const, asset: { id: 'copied', kind: MediaKind.Image, label: 'a.jpg', previewUrl: '/a/copied' } }));
    const onpick = show({ uploader });
    click(byId('media-add'));
    click(byId('media-tab-link'));
    type(byId('media-link'), 'not a link');
    click(byId('media-link-check'));
    expect(byId('media-error').textContent).toContain('https://');
    type(byId('media-link'), 'https://cdn.test/a.jpg');
    click(byId('media-link-check'));
    expect(byId('media-link-preview').querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/a.jpg');
    click(byId('media-link-use'));
    await tick();
    await Promise.resolve();
    flushSync();
    expect(uploader).toHaveBeenCalledWith(new URL('https://cdn.test/a.jpg'), expect.any(Function));
    expect(onpick).toHaveBeenLastCalledWith({ kind: MediaKind.Image, assetId: 'copied' });
  });

  it('uploads a file with progress, then sets the new asset', async () => {
    let finish: (v: Awaited<ReturnType<MediaUploader>>) => void = () => {};
    const uploader = vi.fn((_source: MediaSource, progress: (f: number) => void) => {
      progress(0.5);
      return new Promise<Awaited<ReturnType<MediaUploader>>>((resolve) => (finish = resolve));
    });
    const onpick = show({ uploader });
    click(byId('media-add'));
    const input = byId<HTMLInputElement>('media-file');
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'red.png', { type: 'image/png' })] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(byId('media-progress').getAttribute('value')).toBe('0.5');

    finish({ ok: true, asset: { id: 'new', kind: MediaKind.Image, label: 'red.png', previewUrl: '/a/new' } });
    await tick();
    await Promise.resolve();
    flushSync();
    expect(onpick).toHaveBeenLastCalledWith({ kind: MediaKind.Image, assetId: 'new' });
  });

  it('refuses a dropped file the slot cannot take', () => {
    const uploader = vi.fn() as unknown as MediaUploader;
    show({ uploader, accept: MediaAccept.Image });
    const drop = new Event('drop', { bubbles: true }) as Event & { dataTransfer: unknown };
    drop.dataTransfer = { files: [new File(['x'], 'clip.mp4', { type: 'video/mp4' })] };
    byId('media-picker').dispatchEvent(drop);
    flushSync();
    expect(uploader).not.toHaveBeenCalled();
    expect(byId('media-error').textContent).toContain('image');
  });
});
