import type { Library } from '$lib/motion/style-library';
import type { Style } from '$lib/motion/styles-model';

export type StylePush = (name: string, style: Style) => void;

export class StyleLibrary {
  styles = $state<Library>({});
  private sink: StylePush | null = null;

  connect(sink: StylePush | null) {
    this.sink = sink;
  }

  push(name: string, style: Style) {
    this.styles = { ...this.styles, [name]: style };
    this.sink?.(name, style);
  }
}

export const styleLibrary = new StyleLibrary();
