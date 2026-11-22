const MIN_TOKEN_LIFE_S = 35 * 60;

export function outlivesTurn(session: { expires_at?: number }, nowS = Math.floor(Date.now() / 1000)): boolean {
  if (session.expires_at === undefined) {
    return true;
  }
  return session.expires_at - nowS >= MIN_TOKEN_LIFE_S;
}
