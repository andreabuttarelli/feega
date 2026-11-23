import { describe, expect, it } from 'vitest';
import { ImpactKind, type Impact } from '../messages';
import { IMPACT_VIEW, ImpactIcon, Tone, impactView } from './impact-view';

const local: Impact = { kind: ImpactKind.Local };
const component = (count: number): Impact => ({ kind: ImpactKind.Component, name: 'Button', files: Array.from({ length: count }, (_, i) => ({ file: `src/p${i}.tsx`, line: 1 })) });
const unknown: Impact = { kind: ImpactKind.Unknown, reason: 'a CSS variable can reach other elements' };

describe('IMPACT_VIEW', () => {
  it('ogni tipo ha icona, tono ed etichetta', () => {
    expect(Object.keys(IMPACT_VIEW).sort()).toEqual(Object.values(ImpactKind).sort());
  });

  it('i tre tipi si distinguono per tono e icona', () => {
    const tones = Object.values(IMPACT_VIEW).map((v) => v.tone);
    const icons = Object.values(IMPACT_VIEW).map((v) => v.icon);

    expect(new Set(tones).size).toBe(3);
    expect(new Set(icons).size).toBe(3);
  });
});

describe('impactView', () => {
  it('un elemento locale dice che resta li', () => {
    expect(impactView(local, 1)).toMatchObject({ label: 'This element only', tone: Tone.Local, icon: ImpactIcon.Target, files: [] });
  });

  it('un elemento locale ripetuto in una lista lo dice', () => {
    expect(impactView(local, 4).label).toBe('This file only · ×4 on this page');
  });

  it('un componente dice il nome e in quanti file e usato', () => {
    expect(impactView(component(5), 1)).toMatchObject({ label: 'Button component · used in 5 files', tone: Tone.Shared, icon: ImpactIcon.Layers });
  });

  it('un componente usato in un file solo usa il singolare', () => {
    expect(impactView(component(1), 1).label).toBe('Button component · used in 1 file');
  });

  it('un componente aggiunge le istanze di questa pagina', () => {
    expect(impactView(component(5), 3).label).toBe('Button component · used in 5 files · ×3 here');
  });

  it('un componente porta la lista dei file da aprire', () => {
    expect(impactView(component(2), 1).files).toEqual([
      { file: 'src/p0.tsx', line: 1 },
      { file: 'src/p1.tsx', line: 1 }
    ]);
  });

  it('un impatto ignoto avvisa e spiega perche', () => {
    expect(impactView(unknown, 1)).toMatchObject({ label: 'Impact unknown', tone: Tone.Unknown, icon: ImpactIcon.Alert, hint: 'a CSS variable can reach other elements' });
  });

  it('prima della risposta dell host mostra che sta controllando', () => {
    expect(impactView(null, 1)).toMatchObject({ label: 'Checking where this lands', tone: Tone.Pending });
  });
});
