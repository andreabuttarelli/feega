import type { Collection, Variables } from '$lib/motion/variables-model';

export type VariableSink = {
  push: (name: string, collection: Collection) => void;
  remove: (collection: string, variable: string) => void;
};

export class VariableLibrary {
  collections = $state<Variables>({});
  private sink: VariableSink | null = null;

  connect(sink: VariableSink | null) {
    this.sink = sink;
  }

  push(name: string, collection: Collection) {
    this.collections = { ...this.collections, [name]: collection };
    this.sink?.push(name, collection);
  }

  remove(collection: string, variable: string) {
    const kept = this.collections[collection];
    if (kept) {
      const { [variable]: _gone, ...vars } = kept.vars;
      this.collections = { ...this.collections, [collection]: { ...kept, vars } };
    }
    this.sink?.remove(collection, variable);
  }
}

export const variableLibrary = new VariableLibrary();
