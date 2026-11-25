const MAX_ZOOM = 4;
const NO_ZOOM = 1;

const valueText = (value) => (typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value));
const labelOf = (props) => Object.entries(props).map(([name, value]) => `${name}=${valueText(value)}`).join(' · ');

export function gridOf(variants) {
  const names = Object.keys(variants[0]?.props ?? {});
  const columnName = names.at(-1) ?? '';
  const rowNames = names.slice(0, -1);
  const columns = [...new Set(variants.map((variant) => valueText(variant.props[columnName])))];
  const byRow = new Map();

  for (const variant of variants) {
    const header = labelOf(Object.fromEntries(rowNames.map((name) => [name, variant.props[name]])));
    const row = byRow.get(header) ?? { header, cells: columns.map(() => null) };
    row.cells[columns.indexOf(valueText(variant.props[columnName]))] = variant;
    byRow.set(header, row);
  }

  return { columnName, columns, rows: [...byRow.values()] };
}

export function fitZoom(box, canvas, padding) {
  if (!box.width || !box.height) {
    return NO_ZOOM;
  }
  const fit = Math.min((canvas.width - padding * 2) / box.width, (canvas.height - padding * 2) / box.height);
  return Math.min(Math.max(fit, NO_ZOOM), MAX_ZOOM);
}
