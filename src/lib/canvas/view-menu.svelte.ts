import { Command, SHORTCUTS } from '$lib/motion/shortcuts';
import { FRAME_VIEW_DEFAULT, FrameView, flipView, shows, type FrameViews } from './frame-view';
import { flipRulers, rulersPref } from './rulers-pref.svelte';

const keysOf = (command: Command): string => SHORTCUTS.find((b) => b.command === command)?.label ?? '';

const item = (view: FrameView, command: Command, label: string) => ({ view, command, label, keys: keysOf(command) });

export const VIEW_ITEMS = [
  item(FrameView.Outlines, Command.ToggleOutlines, 'Outlines'),
  item(FrameView.PixelGrid, Command.TogglePixelGrid, 'Pixel grid'),
  item(FrameView.Guides, Command.ToggleLayoutGuides, 'Layout guides'),
  item(FrameView.Rulers, Command.ToggleRulers, 'Rulers'),
  item(FrameView.Pivot, Command.TogglePivot, 'Rotation pivot')
] as const;

class FrameViewState {
  local = $state<FrameViews>(FRAME_VIEW_DEFAULT);

  get all(): FrameViews {
    return { ...this.local, [FrameView.Rulers]: rulersPref.on };
  }

  isOn(view: FrameView): boolean {
    return shows(this.all, view);
  }

  flip(view: FrameView) {
    if (view === FrameView.Rulers) {
      flipRulers();
      return;
    }

    this.local = flipView(this.local, view);
  }
}

export const frameViews = new FrameViewState();
