export enum NodeMode {
  Preview = 'preview',
  Edit = 'edit'
}

type Row = { id: string; type: string };

export function inlineMotionTarget(selected: readonly string[], rows: readonly Row[], dismissed: string | null): string | null {
  if (selected.length !== 1 || selected[0] === dismissed) {
    return null;
  }
  return rows.find((r) => r.id === selected[0])?.type === 'motion' ? selected[0] : null;
}
