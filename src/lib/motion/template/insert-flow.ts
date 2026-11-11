import type { Inserted } from './library';

export type InsertSteps = {
  place: () => Inserted;
  edit: (placed: Inserted) => void;
  close: () => void;
};

export function insertThenClose({ place, edit, close }: InsertSteps): Inserted {
  const placed = place();
  edit(placed);
  close();
  return placed;
}
