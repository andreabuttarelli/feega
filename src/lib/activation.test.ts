import { describe, expect, it } from 'vitest';
import { CoreEvent } from '$lib/core-usage';
import { activated, northStarTeam } from './activation';

const SIGNUP = Date.parse('2026-11-01T10:00:00Z');
const at = (hours: number) => SIGNUP + hours * 3_600_000;

describe('activated', () => {
  it('aperto un canvas e creato o modificato un frame entro 24 ore dalla registrazione', () => {
    expect(activated(SIGNUP, [{ event: CoreEvent.CanvasOpened, at: at(1) }, { event: CoreEvent.FrameCreated, at: at(2) }])).toBe(true);
    expect(activated(SIGNUP, [{ event: CoreEvent.CanvasOpened, at: at(1) }, { event: CoreEvent.FrameEdited, at: at(23) }])).toBe(true);
  });

  it('un frame dopo 24 ore, o un canvas solo aperto, non attiva', () => {
    expect(activated(SIGNUP, [{ event: CoreEvent.CanvasOpened, at: at(1) }, { event: CoreEvent.FrameCreated, at: at(25) }])).toBe(false);
    expect(activated(SIGNUP, [{ event: CoreEvent.CanvasOpened, at: at(1) }])).toBe(false);
  });
});

describe('northStarTeam', () => {
  it('un team conta nella settimana se ha almeno un export o un azione di un agente', () => {
    expect(northStarTeam([CoreEvent.CanvasOpened, CoreEvent.ExportCompleted])).toBe(true);
    expect(northStarTeam([CoreEvent.AgentAction])).toBe(true);
    expect(northStarTeam([CoreEvent.FrameEdited])).toBe(false);
  });
});
