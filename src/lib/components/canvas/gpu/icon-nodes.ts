import { mount, unmount, type Component } from 'svelte';
import type { IconNode } from '$lib/canvas/core/icon-outline';

export async function iconNodes(icon: Component): Promise<IconNode[]> {
  const host = document.createElement('div');
  const app = mount(icon, { target: host, props: {} });
  const svg = host.querySelector('svg');
  const nodes = svg ? [...svg.querySelectorAll('path,line,circle,ellipse,rect,polyline,polygon')].map((el): IconNode => [el.tagName.toLowerCase(), Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]))]) : [];
  await unmount(app);
  return nodes;
}
