import { describe, expect, it, vi } from 'vitest';
import { keptServers } from './kept-servers';

const server = () => {
  const exits: (() => void)[] = [];
  return { stop: vi.fn(), exited: (then: () => void) => exits.push(then), exit: () => exits.forEach((f) => f()) };
};

describe('keptServers', () => {
  it('ridà il server di un app chiusa e riaperta prima dell idle, senza fermarlo', () => {
    vi.useFakeTimers();
    const kept = keptServers();
    const s = server();
    kept.park('/app', s, 1000);
    vi.advanceTimersByTime(900);
    expect(kept.take('/app')).toBe(s);
    vi.advanceTimersByTime(1000);
    expect(s.stop).not.toHaveBeenCalled();
  });

  it('ferma il server dopo l idle e non lo ridà più', () => {
    vi.useFakeTimers();
    const kept = keptServers();
    const s = server();
    kept.park('/app', s, 1000);
    vi.advanceTimersByTime(1001);
    expect(s.stop).toHaveBeenCalledOnce();
    expect(kept.take('/app')).toBeNull();
  });

  it('non ridà un server già uscito', () => {
    const kept = keptServers();
    const s = server();
    kept.park('/app', s, 1000);
    s.exit();
    expect(kept.take('/app')).toBeNull();
  });

  it('con zero minuti ferma il server alla chiusura del pannello', () => {
    const kept = keptServers();
    const s = server();
    kept.park('/app', s, 0);
    expect(s.stop).toHaveBeenCalledOnce();
    expect(kept.take('/app')).toBeNull();
  });

  it('alla chiusura della finestra li ferma tutti', () => {
    const kept = keptServers();
    const a = server();
    const b = server();
    kept.park('/a', a, 1000);
    kept.park('/b', b, 1000);
    kept.stopAll();
    expect(a.stop).toHaveBeenCalledOnce();
    expect(b.stop).toHaveBeenCalledOnce();
  });
});
