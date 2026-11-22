import { describe, expect, it } from 'vitest';
import { CronMode, cronMode, everyMinutePaths } from './dev-crons';

describe('in sviluppo girano le stesse cron al minuto che Vercel chiama in produzione', () => {
  it('prende solo quelle con cadenza al minuto', () => {
    const crons = [
      { path: '/a', schedule: '*/1 * * * *' },
      { path: '/b', schedule: '0 4 * * *' },
      { path: '/c', schedule: '* * * * *' }
    ];
    expect(everyMinutePaths(crons)).toEqual(['/a', '/c']);
  });

  it('restano spente se non le si chiede: un dev server sul DB remoto non chiude i render degli altri', () => {
    expect(cronMode({})).toBe(CronMode.Off);
    expect(cronMode({ DEV_CRONS: '0' })).toBe(CronMode.Off);
    expect(cronMode({ DEV_CRONS: '1' })).toBe(CronMode.On);
    expect(cronMode({ DEV_CRONS: 'true' })).toBe(CronMode.On);
  });
});

