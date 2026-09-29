import { describe, expect, it } from 'vitest';
import { INITIAL_MOBILE_VIEW, chatBadge, showView, turnEnded } from './mobile-view';

describe('la tela e la chat su mobile', () => {
  it('si parte dalla tela, senza nulla da leggere', () => {
    expect(INITIAL_MOBILE_VIEW).toEqual({ view: 'canvas', unread: false });
  });

  it('una risposta finita mentre si guarda la tela resta da leggere', () => {
    expect(turnEnded(INITIAL_MOBILE_VIEW).unread).toBe(true);
  });

  it('una risposta finita mentre si guarda la chat è già letta', () => {
    expect(turnEnded(showView(INITIAL_MOBILE_VIEW, 'chat')).unread).toBe(false);
  });

  it('aprire la chat la segna letta, tornare alla tela no', () => {
    const unread = turnEnded(INITIAL_MOBILE_VIEW);
    expect(showView(unread, 'chat')).toEqual({ view: 'chat', unread: false });
    expect(showView(unread, 'canvas')).toEqual({ view: 'canvas', unread: true });
  });

  it.each([
    ['idle', false, 'none'],
    ['idle', true, 'unread'],
    ['running', false, 'running'],
    ['running', true, 'running']
  ] as const)('turno %s, da leggere %s → %s', (turn, unread, badge) => {
    expect(chatBadge({ view: 'canvas', unread }, turn)).toBe(badge);
  });
});
