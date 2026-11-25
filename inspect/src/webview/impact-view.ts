import { ImpactKind, type Impact, type UsageSite } from '../messages';

export enum Tone {
  Local = 'local',
  Shared = 'shared',
  Unknown = 'unknown',
  Pending = 'pending'
}

export enum ImpactIcon {
  Target = 'target',
  Layers = 'layers',
  Alert = 'alert'
}

type Of<K extends ImpactKind> = Extract<Impact, { kind: K }>;

type Row<K extends ImpactKind> = { icon: ImpactIcon; tone: Tone; label: (impact: Of<K>, instances: number) => string; files: (impact: Of<K>) => UsageSite[]; hint: (impact: Of<K>) => string };

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

const NO_FILES = () => [];

const NO_HINT = () => '';

export const IMPACT_VIEW: { [K in ImpactKind]: Row<K> } = {
  [ImpactKind.Local]: {
    icon: ImpactIcon.Target,
    tone: Tone.Local,
    label: (_, instances) => (instances > 1 ? `This file only · ×${instances} on this page` : 'This element only'),
    files: NO_FILES,
    hint: NO_HINT
  },
  [ImpactKind.Component]: {
    icon: ImpactIcon.Layers,
    tone: Tone.Shared,
    label: (impact, instances) => `${impact.name} component · used in ${count(impact.files.length, 'file')}${instances > 1 ? ` · ×${instances} here` : ''}`,
    files: (impact) => impact.files,
    hint: NO_HINT
  },
  [ImpactKind.Class]: {
    icon: ImpactIcon.Layers,
    tone: Tone.Shared,
    label: (impact) => `.${impact.name} in ${count(impact.elements, 'element')}, ${count(impact.files.length, 'file')}`,
    files: (impact) => impact.files,
    hint: NO_HINT
  },
  [ImpactKind.Unknown]: {
    icon: ImpactIcon.Alert,
    tone: Tone.Unknown,
    label: () => 'Impact unknown',
    files: NO_FILES,
    hint: (impact) => impact.reason
  }
};

export type ImpactView = { label: string; tone: Tone; icon: ImpactIcon; files: UsageSite[]; hint: string };

const PENDING: ImpactView = { label: 'Checking where this lands', tone: Tone.Pending, icon: ImpactIcon.Target, files: [], hint: '' };

export function impactView(impact: Impact | null, instances: number): ImpactView {
  if (!impact) {
    return PENDING;
  }
  const row = IMPACT_VIEW[impact.kind] as Row<typeof impact.kind>;
  return { label: row.label(impact as never, instances), tone: row.tone, icon: row.icon, files: row.files(impact as never), hint: row.hint(impact as never) };
}
