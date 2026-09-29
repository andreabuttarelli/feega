import { describe, expect, it } from 'vitest';
import { calendarError } from './calendar-posts';

describe('calendarError', () => {
  it('un codice noto diventa una frase, con il motivo del provider accanto', () => {
    expect(calendarError('delivery_failed', 'token expired')).toBe('The social network refused the post. token expired');
  });

  it('un codice sconosciuto non mostra mai il codice grezzo', () => {
    expect(calendarError('pg_error_23505')).toBe('Something went wrong. Try again.');
  });
});
