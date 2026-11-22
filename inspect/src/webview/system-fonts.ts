const CANDIDATES = [
  'Arial', 'Helvetica', 'Helvetica Neue', 'Georgia', 'Times New Roman', 'Times', 'Courier New', 'Courier', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Palatino', 'Garamond', 'Baskerville', 'Didot', 'Optima', 'Futura', 'Gill Sans', 'Avenir', 'Avenir Next', 'Menlo', 'Monaco', 'Consolas', 'Segoe UI', 'Calibri', 'Cambria', 'Impact', 'Rockwell', 'Lucida Grande', 'SF Pro Text', 'SF Mono', 'Ubuntu', 'Cantarell', 'DejaVu Sans', 'Liberation Sans'
];
const BASELINES = ['monospace', 'serif'];
const UNKNOWN_FAMILY = 'feega-no-such-font';
const SAMPLE = 'mmmmmmmmmmlli0Oq';
const SAMPLE_SIZE_PX = 72;

type Measure = (family: string, baseline: string) => string;

export function installedAmong(families: string[], measure: Measure): string[] {
  const same = (family: string, baseline: string) => measure(family, baseline) === measure(UNKNOWN_FAMILY, baseline);
  return families.filter((family) => !BASELINES.every((baseline) => same(family, baseline)));
}

function canvasMeasure(): Measure | null {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) {
    return null;
  }
  return (family, baseline) => {
    context.font = `${SAMPLE_SIZE_PX}px "${family}", ${baseline}`;
    return String(context.measureText(SAMPLE).width);
  };
}

type LocalFonts = () => Promise<{ family: string }[]>;

async function listed(): Promise<string[] | null> {
  const query = (window as unknown as { queryLocalFonts?: LocalFonts }).queryLocalFonts;
  const fonts = await query?.call(window).catch(() => null);
  return fonts ? [...new Set(fonts.map((f) => f.family))].sort() : null;
}

export async function systemFonts(): Promise<string[]> {
  const all = await listed();
  const measure = canvasMeasure();
  return all ?? (measure ? installedAmong(CANDIDATES, measure) : []);
}
