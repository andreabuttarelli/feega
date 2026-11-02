import { Command, SHORTCUTS } from '$lib/motion/shortcuts';
import { FrameView, flipView, shows, type FrameViews } from './frame-view';
import { flipRulers, rulersPref } from './rulers-pref.svelte';
import { readFrameViews, writeFrameViews } from '$lib/shell-prefs';

const keysOf = (command: Command): string => SHORTCUTS.find((b) => b.command === command)?.label ?? '';

const item = (view: FrameView, command: Command, label: string) => ({ view, command, label, keys: keysOf(command) });

export const VIEW_ITEMS = [
  item(FrameView.Outlines, Command.ToggleOutlines, 'Outlines'),
  item(FrameView.PixelGrid, Command.TogglePixelGrid, 'Pixel grid'),
  item(FrameView.Guides, Command.ToggleLayoutGuides, 'Layout guides'),
  item(FrameView.Rulers, Command.ToggleRulers, 'Rulers'),
  item(FrameView.Pivot, Command.TogglePivot, 'Rotation pivot')
] as const;

export const ZOOM_ITEMS = [
  item(FrameView.Outlines, Command.PreviewFit, 'Zoom to fit'),
  item(FrameView.Outlines, Command.PreviewActual, 'Zoom to 100%'),
  item(FrameView.Outlines, Command.PreviewSelection, 'Zoom to selection')
].map(({ command, label, keys }) => ({ command, label, keys }));

class ZoomRequest {
  current = $state<{ command: Command; seq: number } | null>(null);
  private seq = 0;

  ask(command: Command) {
    this.current = { command, seq: ++this.seq };
  }
}

export const zoomRequest = new ZoomRequest();

class FrameViewState {
  local = $state<FrameViews>(readFrameViews());

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
    writeFrameViews(this.local);
  }
}

export const frameViews = new FrameViewState();
