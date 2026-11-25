import { ImpactKind, type Impact } from '../messages';

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
