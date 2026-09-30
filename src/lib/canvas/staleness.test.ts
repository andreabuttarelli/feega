import { describe, expect, it } from 'vitest';
import { Remote, Trigger, Verdict, changedElsewhere, judge } from './staleness';

const live = (revision: string) => ({ kind: Remote.Live, revision }) as const;

function check(over: Partial<Parameters<typeof judge>[0]> = {}) {
  return { seen: 'r1', remote: live('r1'), trigger: Trigger.Return, appUpdated: false, ...over };
}

describe('judge', () => {
  it('stessa revisione: nessuna azione', () => {
    expect(judge(check())).toEqual([]);
  });

  it('revisione più nuova: la tela si risincronizza', () => {
    expect(judge(check({ remote: live('r2') }))).toEqual([Verdict.Resync]);
  });

  it('tela cancellata altrove: si lascia la tela, nient\'altro', () => {
    expect(judge(check({ remote: { kind: Remote.CanvasGone }, appUpdated: true }))).toEqual([Verdict.LeaveCanvas]);
  });

  it('progetto cancellato altrove: si lascia il progetto', () => {
    expect(judge(check({ remote: { kind: Remote.ProjectGone } }))).toEqual([Verdict.LeaveProject]);
  });

  it('nuova versione dell\'app: si offre il reload senza ricaricare', () => {
    expect(judge(check({ appUpdated: true }))).toEqual([Verdict.OfferReload]);
  });

  it('nuova versione e tela cambiata: risincronizza e offre il reload', () => {
    expect(judge(check({ appUpdated: true, remote: live('r2') }))).toEqual([Verdict.Resync, Verdict.OfferReload]);
  });

  it('di nuovo online: risincronizza anche a revisione uguale, una volta sola', () => {
    expect(judge(check({ trigger: Trigger.Online }))).toEqual([Verdict.Resync]);
    expect(judge(check({ trigger: Trigger.Online, remote: live('r2') }))).toEqual([Verdict.Resync]);
  });
});

describe('changedElsewhere', () => {
  const tile = (id: string, version: number, x = 0, y = 0) => ({ id, version, x, y });

  it('le proprie scritture già adottate non contano come cambiamento', () => {
    expect(changedElsewhere([tile('a', 2)], [tile('a', 2)])).toBe(false);
  });

  it('una versione nuova, un nodo nuovo o sparito, uno spostamento contano', () => {
    expect(changedElsewhere([tile('a', 1)], [tile('a', 2)])).toBe(true);
    expect(changedElsewhere([tile('a', 1)], [tile('a', 1), tile('b', 1)])).toBe(true);
    expect(changedElsewhere([tile('a', 1), tile('b', 1)], [tile('a', 1)])).toBe(true);
    expect(changedElsewhere([tile('a', 1)], [tile('a', 1, 10, 0)])).toBe(true);
  });
});
