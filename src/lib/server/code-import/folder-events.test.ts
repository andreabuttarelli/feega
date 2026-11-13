import { describe, expect, it } from 'vitest';
import { pagesCounted, stepEvents } from './folder-events';
import { FolderStep, StepState } from './folder-source';

describe('folder events', () => {
  it('ogni passo della cartella esce come una riga feega:event che il launcher inoltra', () => {
    const lines: string[] = [];
    stepEvents((l) => lines.push(l))(FolderStep.Install, StepState.Active, 'bun');
    expect(lines).toEqual(['feega:event {"event":"step","step":"dependencies","state":"active","manager":"bun"}']);
  });

  it('ogni pagina aperta dice a che punto è, senza superare il totale', async () => {
    const lines: string[] = [];
    const open = pagesCounted(async () => 'tab', 2, (l) => lines.push(l));
    await open();
    await open();
    await open();
    expect(lines.map((l) => JSON.parse(l.slice('feega:event '.length)).index)).toEqual([1, 2, 2]);
  });
});
