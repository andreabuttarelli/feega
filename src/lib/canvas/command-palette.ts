import { ACTIONS } from '$lib/motion/actions';
import { EditMode } from '$lib/motion/edit-mode';
import { Command, SHORTCUTS, commandFor } from '$lib/motion/shortcuts';
import { canRunInFrame } from './frame-inspector';
import { CANVAS_COMMAND_OF } from './shortcuts';

export type PaletteEntry = { command: Command; name: string; does: string; label: string };

type Binding = (typeof SHORTCUTS)[number];

const inDesign = (b: Binding) => (b.mode ?? EditMode.Design) === EditMode.Design;

const reachable = (b: Binding) => commandFor({ key: b.key, mod: !!b.mod, shift: !!b.shift, alt: !!b.alt, ctrlCmd: !!b.ctrlCmd }, EditMode.Design) === b.command;

const bindingOf = (command: Command) => SHORTCUTS.find((b) => b.command === command && inDesign(b) && reachable(b));

const runnable = (command: Command) => canRunInFrame(command) || command in CANVAS_COMMAND_OF;

function entryOf(command: Command): PaletteEntry {
  const binding = bindingOf(command);
  return { command, name: ACTIONS[command].name, does: binding?.does ?? ACTIONS[command].name, label: binding?.label ?? '' };
}

export const PALETTE: readonly PaletteEntry[] = Object.values(Command).filter(runnable).map(entryOf);

export function searchPalette(query: string): PaletteEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return PALETTE.filter((e) => {
    const text = `${e.name} ${e.does}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}
