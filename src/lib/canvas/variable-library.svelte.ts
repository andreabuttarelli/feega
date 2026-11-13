import { adoptBatch } from './adopt-batch';
import type { Collection, Variables } from '@feega/motion-core/motion/variables-model';
import { LibraryOp, type LibraryAsk } from '$lib/motion/project-library-ops';
import type { LibraryStore } from './project-library-store';
import { sameValue } from './node-patch';

export type VariableSink = {
  push: (name: string, collection: Collection) => void;
  remove: (collection: string, variable: string) => void;
};

const shared = ({ active: _ownMode, ...collection }: Collection): Collection => collection;

const sameShape = (a: Collection | undefined, b: Collection | undefined) => sameValue(a && shared(a), b && shared(b));

export class VariableLibrary {
  collections = $state<Variables>({});
  failed = $state(false);
  private sink: VariableSink | null = null;
  private store: LibraryStore | null = null;
  private seen: Variables = {};
  private adopt = adoptBatch<Collection>((entries) => void this.store?.send({ op: LibraryOp.Adopt, entries }));

  private keepUnknown(inDocs: Variables) {
    const unknown = Object.fromEntries(Object.entries(inDocs).filter(([name]) => !this.collections[name]));
    if (Object.keys(unknown).length) {
      this.collections = { ...this.collections, ...unknown };
    }
  }

  connect(sink: VariableSink | null) {
    this.sink = sink;
  }

  async open(store: LibraryStore | null) {
    this.store = store;
    if (!store) {
      this.collections = {};
      return;
    }
    this.collections = (await store.load()) as Variables;
    this.found(this.seen);
  }

  found(inDocs: Variables) {
    this.seen = inDocs;
    if (!this.store) {
      this.keepUnknown(inDocs);
      return;
    }
    const fresh = Object.fromEntries(Object.entries(inDocs).filter(([name]) => !this.collections[name]).map(([name, c]) => [name, shared(c)]));
    if (Object.keys(fresh).length) {
      this.collections = { ...this.collections, ...fresh };
      this.adopt(fresh);
    }
    for (const [name, collection] of Object.entries(inDocs)) {
      if (!sameShape(collection, this.collections[name])) {
        this.sink?.push(name, this.collections[name]);
      }
    }
  }

  private async saved(ask: LibraryAsk, undo: () => void) {
    const ok = (await this.store?.send(ask)) ?? true;
    this.failed = !ok;
    if (!ok) {
      undo();
    }
  }

  push(name: string, collection: Collection): Promise<void> {
    const before = this.collections[name];
    this.collections = { ...this.collections, [name]: collection };
    this.sink?.push(name, collection);
    return this.saved({ op: LibraryOp.Save, name, value: shared(collection) }, () => this.restore(name, before));
  }

  remove(collection: string, variable: string): Promise<void> {
    const before = this.collections[collection];
    this.sink?.remove(collection, variable);
    if (!before) {
      return Promise.resolve();
    }
    const { [variable]: _gone, ...vars } = before.vars;
    const kept = { ...before, vars };
    this.collections = { ...this.collections, [collection]: kept };
    return this.saved({ op: LibraryOp.Save, name: collection, value: shared(kept) }, () => this.restore(collection, before));
  }

  private restore(name: string, before: Collection | undefined) {
    if (!before) {
      const { [name]: _gone, ...others } = this.collections;
      this.collections = others;
      return;
    }
    this.collections = { ...this.collections, [name]: before };
    this.sink?.push(name, before);
  }
}

export const variableLibrary = new VariableLibrary();
