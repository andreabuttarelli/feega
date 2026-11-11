import { propsOf, snapcnSource, type SnapcnPort } from '../snapcn/model';

type Update = { onUpdate: (this: { time: () => number }) => void };

export const defaultsOf = (port: SnapcnPort) => Object.fromEntries(Object.entries(propsOf(port)).map(([key, spec]) => [key, spec.default]));

export function playAt(port: SnapcnPort, props: Record<string, unknown>, frames: readonly number[]) {
  const root = document.createElement('div');
  const updates: Update[] = [];
  const tl = { to: (_: unknown, vars: Update) => updates.push(vars) };
  const duration = port.frames / port.fps;
  new Function('root', 'props', 'tl', 'duration', 'fps', snapcnSource(port))(root, props, tl, duration, port.fps);
  for (const frame of frames) {
    updates.forEach((u) => u.onUpdate.call({ time: () => frame / port.fps }));
  }
  return root;
}
