import { adoptBatch } from './adopt-batch';
import type { Library } from '$lib/motion/style-library';
import { LibraryOp, type LibraryAsk } from '$lib/motion/project-library-ops';
import type { LibraryStore } from './project-library-store';
import { STYLE_NAME, type Style } from '@feega/motion-core/motion/styles-model';
import { sameValue } from './node-patch';

export type StyleSink = {
  push: (name: string, style: Style) => void;
  rename: (from: string, to: string) => void;
  remove: (name: string) => void;
};


export class StyleLibrary {
  styles = $state<Library>({});
  failed = $state(false);
  private sink: StyleSink | null = null;
  private store: LibraryStore | null = null;
  private seen: Library = {};
  private queue: Promise<unknown> = Promise.resolve();
  private renamedTo = new Map<string, string>();
  private adopt = adoptBatch<Style>((entries) => void this.send({ op: LibraryOp.Adopt, entries }));

  connect(sink: StyleSink | null) {
    this.sink = sink;
  }

  async open(store: LibraryStore | null) {
    this.store = store;
    if (!store) {
      this.styles = {};
      return;
    }
    this.styles = (await store.load()) as Library;
    this.found(this.seen);
  }

  found(inDocs: Library) {
    this.seen = inDocs;
    const fresh = Object.fromEntries(Object.entries(inDocs).filter(([name]) => !this.styles[name]));
    if (Object.keys(fresh).length) {
      this.styles = { ...this.styles, ...fresh };
    }
    if (!this.store) {
      return;
    }
    if (Object.keys(fresh).length) {
      this.adopt(fresh);
    }
    for (const [name, style] of Object.entries(inDocs)) {
      if (!sameValue(style, this.styles[name])) {
        this.sink?.push(name, this.styles[name]);
      }
    }
  }

  private send(ask: LibraryAsk): Promise<boolean> {
    const turn = this.queue.then(() => this.store?.send(ask) ?? true).catch(() => false);
    this.queue = turn;
    return turn;
  }

  private async saved(ask: LibraryAsk, undo: () => void) {
    const ok = await this.send(ask);
    this.failed = !ok;
    if (!ok) {
      undo();
    }
  }

  private current(name: string): string {
    const to = this.styles[name] ? undefined : this.renamedTo.get(name);
    return to ? this.current(to) : name;
  }

  push(stale: string, style: Style): Promise<void> {
    const name = this.current(stale);
    const before = this.styles[name];
    this.styles = { ...this.styles, [name]: style };
    this.sink?.push(name, style);
    return this.saved({ op: LibraryOp.Save, name, value: style }, () => {
      if (!before) {
        this.drop(name);
        return;
      }
      this.styles = { ...this.styles, [name]: before };
      this.sink?.push(name, before);
    });
  }

  rename(from: string, to: string): Promise<void> {
    if (from === to || !STYLE_NAME.test(to) || !this.styles[from] || this.styles[to]) {
      return Promise.resolve();
    }
    this.moved(from, to);
    return this.saved({ op: LibraryOp.Rename, name: from, to }, () => this.moved(to, from));
  }

  remove(name: string): Promise<void> {
    const before = this.styles[name];
    if (!before) {
      return Promise.resolve();
    }
    this.drop(name);
    this.sink?.remove(name);
    return this.saved({ op: LibraryOp.Remove, name }, () => (this.styles = { ...this.styles, [name]: before }));
  }

  private moved(from: string, to: string) {
    this.renamedTo.set(from, to);
    this.renamedTo.delete(to);
    this.styles = Object.fromEntries(Object.entries(this.styles).map(([name, style]) => [name === from ? to : name, style]));
    this.sink?.rename(from, to);
  }

  private drop(name: string) {
    const { [name]: _gone, ...others } = this.styles;
    this.styles = others;
  }
}

export const styleLibrary = new StyleLibrary();
