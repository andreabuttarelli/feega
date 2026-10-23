import type { Library } from '$lib/motion/style-library';
import { STYLE_NAME, type Style } from '$lib/motion/styles-model';

export type StyleSink = {
  push: (name: string, style: Style) => void;
  rename: (from: string, to: string) => void;
};

export class StyleLibrary {
  styles = $state<Library>({});
  private sink: StyleSink | null = null;

  connect(sink: StyleSink | null) {
    this.sink = sink;
  }

  push(name: string, style: Style) {
    this.styles = { ...this.styles, [name]: style };
    this.sink?.push(name, style);
  }

  rename(from: string, to: string) {
    if (from === to || !STYLE_NAME.test(to) || !this.styles[from] || this.styles[to]) {
      return;
    }
    const { [from]: style, ...others } = this.styles;
    this.styles = { ...others, [to]: style };
    this.sink?.rename(from, to);
  }
}

export const styleLibrary = new StyleLibrary();
