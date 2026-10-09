import { describe, it, expect, vi, afterEach } from 'vitest';
import { AGENT_MAX_STEPS, AGENT_DEADLINE_MS, AGENT_MAX_DURATION_S, AGENT_SELF_SAVE_MS, AGENT_STALE_MS, AGENT_TURN_CAP_USD, agentStopWhen, overTurnCap } from './limits';

describe('i limiti di un turno della chat di brand', () => {
  afterEach(() => vi.useRealTimers());

  it('lascia abbastanza passi per disporre una tela intera', () => {
    // Una tile per `insert_row`: dieci post sulla tela sono dieci passi, e prima ci sono
    // l'analisi, le letture e le scritture del brand. A 12 il turno finiva a metà lavoro.
    expect(AGENT_MAX_STEPS).toBeGreaterThanOrEqual(70);
  });

  it('si ferma PRIMA che la piattaforma tagli la funzione', () => {
    // Il taglio di Vercel non è una fine del turno: è una risposta troncata, senza `onFinish`,
    // quindi senza il turno salvato. Il margine è ciò che fa chiudere l'agente da sé.
    expect(AGENT_DEADLINE_MS).toBeLessThan(AGENT_MAX_DURATION_S * 1000);
  });

  it('ferma il turno quando la deadline è passata', () => {
    vi.useFakeTimers();
    const startedAt = Date.now();
    const stop = agentStopWhen(startedAt);

    vi.setSystemTime(startedAt + AGENT_DEADLINE_MS + 1);

    expect(stop({ steps: [] })).toBe(true);
  });

  it('lascia correre un turno giovane che non ha speso i passi', () => {
    vi.useFakeTimers();
    const startedAt = Date.now();
    const stop = agentStopWhen(startedAt);

    vi.setSystemTime(startedAt + 1_000);

    expect(stop({ steps: new Array(3) })).toBe(false);
  });

  it('ferma il turno che ha speso tutti i passi, anche se ha tempo', () => {
    vi.useFakeTimers();
    const startedAt = Date.now();
    const stop = agentStopWhen(startedAt);

    vi.setSystemTime(startedAt + 1_000);

    expect(stop({ steps: new Array(AGENT_MAX_STEPS) })).toBe(true);
  });

  it('runs as long as Vercel lets a function run: 30 minutes', () => {
    expect(AGENT_MAX_DURATION_S).toBe(1800);
  });

  it('saves the turn itself after the agent stops and before the platform cuts', () => {
    expect(AGENT_SELF_SAVE_MS).toBeGreaterThan(AGENT_DEADLINE_MS);
    expect(AGENT_SELF_SAVE_MS).toBeLessThan(AGENT_MAX_DURATION_S * 1000);
  });

  it('never reaps a turn the platform may still be running', () => {
    expect(AGENT_STALE_MS).toBeGreaterThanOrEqual(AGENT_MAX_DURATION_S * 1000);
  });

  it('stops a turn that spent its cap, however much time is left', () => {
    let spent = 0;
    const stop = overTurnCap(() => spent);

    expect(stop({ steps: [] })).toBe(false);
    spent = AGENT_TURN_CAP_USD + 0.01;
    expect(stop({ steps: [] })).toBe(true);
  });
});

describe('every agent route runs for the agent limit', () => {
  it.each([
    ['canvas chat', () => import('../../../routes/api/v1/projects/[projectId]/agent/+server')],
    ['motion chat', () => import('../../../routes/api/v1/projects/[projectId]/motion/[nodeId]/agent/+server')],
    ['motion ask', () => import('../../../routes/api/v1/motion/[nodeId]/ask/+server')]
  ])('%s', async (_name, route) => {
    expect((await route()).config.maxDuration).toBe(AGENT_MAX_DURATION_S);
  });
});
