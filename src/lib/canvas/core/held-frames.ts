type Gesture = { resizing: ReadonlySet<string>; heldOnResize: (id: string) => boolean; moving: Iterable<string>; shown: Iterable<string>; base: (id: string) => string };

export function heldFrames({ resizing, heldOnResize, moving, shown, base }: Gesture): ReadonlySet<string> {
  const moved = new Set(moving);
  const following = [...shown].filter((id) => id !== base(id) && moved.has(base(id)));
  return new Set([...[...resizing].filter(heldOnResize), ...moved, ...following]);
}
