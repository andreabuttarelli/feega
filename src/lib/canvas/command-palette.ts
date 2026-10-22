import { ACTIONS } from '$lib/motion/actions';
import { EditMode } from '$lib/motion/edit-mode';
import { SHORTCUTS, commandFor, type Command } from '$lib/motion/shortcuts';

type Binding = (typeof SHORTCUTS)[number];

export type PaletteEntry = { command: Command; name: string; does: string; label: string; binding: Binding };

const inDesign = (b: Binding) => (b.mode ?? EditMode.Design) === EditMode.Design;

const reachable = (b: Binding) => commandFor({ key: b.key, mod: !!b.mod, shift: !!b.shift, alt: !!b.alt, ctrlCmd: !!b.ctrlCmd }, EditMode.Design) === b.command;

const firstBindings = SHORTCUTS.filter((b) => inDesign(b) && reachable(b)).filter((b, i, all) => all.findIndex((o) => o.command === b.command) === i);

export const PALETTE: readonly PaletteEntry[] = firstBindings.map((b) => ({ command: b.command, name: ACTIONS[b.command]?.name ?? b.does, does: b.does, label: b.label, binding: b }));

export function searchPalette(query: string): PaletteEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return PALETTE.filter((e) => {
    const text = `${e.name} ${e.does}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

const LETTER = /^[a-z]$/;
const DIGIT = /^[0-9]$/;

function codeOf(key: string): string | undefined {
  if (LETTER.test(key)) {
    return `Key${key.toUpperCase()}`;
  }
  return DIGIT.test(key) ? `Digit${key}` : undefined;
}

export function keyEventOf({ binding }: PaletteEntry): KeyboardEventInit {
  return {
    key: binding.key,
    code: codeOf(binding.key),
    metaKey: !!binding.mod,
    ctrlKey: !!binding.ctrlCmd,
    shiftKey: !!binding.shift,
    altKey: !!binding.alt,
    bubbles: true,
    cancelable: true
  };
}
