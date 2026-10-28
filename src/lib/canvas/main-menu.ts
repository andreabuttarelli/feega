import { Command, SHORTCUTS } from '$lib/motion/shortcuts';
import { ThemePref } from '$lib/theme';

export const PREFERENCE_ITEMS = [{ command: Command.ToggleRulers, labelKey: 'app.shell.menu.rulers' }] as const;

export const THEME_CHOICES: readonly ThemePref[] = [ThemePref.Light, ThemePref.Dark, ThemePref.System];

export function preferenceShortcut(command: Command): string {
  return SHORTCUTS.find((b) => b.command === command)?.label ?? '';
}
