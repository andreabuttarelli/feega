import { AGENT_MAX_DURATION_S } from '$lib/server/brand-agent/limits';

const TURN_MARGIN_S = 5 * 60;
const MIN_TOKEN_LIFE_S = AGENT_MAX_DURATION_S + TURN_MARGIN_S;

export function outlivesTurn(session: { expires_at?: number }, nowS = Math.floor(Date.now() / 1000)): boolean {
  if (session.expires_at === undefined) {
    return true;
  }
  return session.expires_at - nowS >= MIN_TOKEN_LIFE_S;
}
