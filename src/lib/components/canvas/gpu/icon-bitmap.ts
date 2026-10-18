import { mount, unmount, type Component } from 'svelte';

const ICON_RASTER_PX = 48;

export async function iconBitmap(icon: Component<{ size?: number; strokeWidth?: number; color?: string }>): Promise<ImageBitmap> {
  const host = document.createElement('div');
  const app = mount(icon, { target: host, props: { size: ICON_RASTER_PX, strokeWidth: 1.8, color: '#ffffff' } });
  const svg = host.querySelector('svg')!.outerHTML;
  await unmount(app);
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  return createImageBitmap(image);
}
