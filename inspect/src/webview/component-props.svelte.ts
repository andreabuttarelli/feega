import type { ComponentRow } from '../host/component-list';
import type { Controls } from './canvas-card';
import { keyOfComponent } from './components';
import { badgeOf, fieldsOf, loadedFrom, parseField, propsFor, savedOf, withEdit, type Chosen, type Edits, type FieldKind, type SavedComponents } from './component-props';

export class ExampleProps {
  chosen = $state<Chosen>({});
  edits = $state<Edits>({});
  controls = $state<Record<string, Controls>>({});
  shown = $state<Record<string, Record<string, unknown>>>({});
  revision = $state<Record<string, number>>({});

  constructor(private readonly changed: () => void) {}

  propsOf = (row: ComponentRow) => propsFor(row, this.chosen[keyOfComponent(row)], this.edits[keyOfComponent(row)] ?? {});

  fieldsOf = (row: ComponentRow) => fieldsOf(row, this.chosen[keyOfComponent(row)], this.edits[keyOfComponent(row)] ?? {}, this.controls[keyOfComponent(row)] ?? null);

  badgeOf = (row: ComponentRow) => badgeOf(row, this.chosen[keyOfComponent(row)], this.edits[keyOfComponent(row)] ?? {}, this.shown[keyOfComponent(row)]);

  chosenOf = (row: ComponentRow) => this.chosen[keyOfComponent(row)];

  choose(row: ComponentRow, id: string) {
    this.chosen[keyOfComponent(row)] = id;
    this.reload(keyOfComponent(row));
  }

  edit(row: ComponentRow, name: string, text: string, kind: FieldKind) {
    this.edits = withEdit(this.edits, keyOfComponent(row), name, text === '' ? undefined : parseField(text, kind));
    this.reload(keyOfComponent(row));
  }

  load(saved: SavedComponents | undefined) {
    const loaded = loadedFrom(saved);
    this.chosen = loaded.chosen;
    this.edits = loaded.edits;
  }

  saved = () => savedOf($state.snapshot(this.chosen), $state.snapshot(this.edits));

  private reload(key: string) {
    this.revision[key] = (this.revision[key] ?? 0) + 1;
    this.changed();
  }
}
