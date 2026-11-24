import { ImpactKind, type Impact } from '../messages';

const SOURCE = /^source: (.+?):(\d+):\d+$/m;
const SELECTOR = /^selector: (.+)$/m;
const MANY = /^Feega selection: (\d+ elements)/;

export const chipOf = (context: string | null): string | null => {
  if (context === null) {
    return null;
  }
  const many = context.match(MANY);
  if (many) {
    return many[1];
  }
  const source = context.match(SOURCE);
  const selector = context.match(SELECTOR);
  return source ? [`${source[1]}:${source[2]}`, selector?.[1]].filter(Boolean).join(' ') : null;
};

const impactLine = (impact: Impact): string | null => {
  if (impact.kind === ImpactKind.Local) {
    return 'impact: this element only';
  }
  if (impact.kind === ImpactKind.Component) {
    return `impact: component ${impact.name} used in ${impact.files.length} places`;
  }
  return null;
};

export const withImpact = (context: string, impact: Impact | null): string => {
  const line = impact ? impactLine(impact) : null;
  return line ? `${context}\n${line}` : context;
};
