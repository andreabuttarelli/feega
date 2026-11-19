import { describe, expect, it } from 'vitest';
import { FrameMode, LIVE_MODE, LiveFrameState, liveFrameModes } from './live-budget';

describe('liveFrameModes', () => {
  it('sulla tela un live frame mostra lo snapshot, anche se in vista e selezionato', () => {
    expect(liveFrameModes(['a', 'b'], null)).toEqual({ a: FrameMode.Snapshot, b: FrameMode.Snapshot });
  });

  it('solo il frame in modifica diventa live, e torna snapshot quando si esce', () => {
    expect(liveFrameModes(['a', 'b'], 'b')).toEqual({ a: FrameMode.Snapshot, b: FrameMode.Live });
    expect(liveFrameModes(['a', 'b'], null).b).toBe(FrameMode.Snapshot);
  });

  it('in play la pagina è live', () => {
    expect(LIVE_MODE[LiveFrameState.Playing]).toBe(FrameMode.Live);
  });
});
