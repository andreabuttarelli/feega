import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { Connection } from '$lib/onboarding/session.svelte';
import { Place } from '$lib/onboarding/flow';
import StepHome from './StepHome.svelte';
import StepAccount from './StepAccount.svelte';

const home = (place: Place) => render(StepHome, { props: { place, email: 'ada@example.com', oncontinue: () => {}, oncloud: () => {} } }).body;
const account = (email: string | null) => render(StepAccount, { props: { email, connection: Connection.Idle, onconnect: () => {}, oncontinue: () => {} } }).body;

describe('dove vive il lavoro: si sceglie con un clic, non passandoci sopra', () => {
  it('ogni posto è una scelta radio, e quella scelta è spuntata', () => {
    const body = home(Place.Cloud);

    expect(body.match(/type="radio"/g)).toHaveLength(2);
    expect(body).toMatch(/type="radio"[^>]*value="cloud"[^>]*checked|checked[^>]*value="cloud"/);
  });

  it('con Feega Cloud scelto il bottone apre feega cloud', () => {
    expect(home(Place.Cloud)).toContain('open feega cloud');
    expect(home(Place.Computer)).toContain('continue on this computer');
  });
});

describe('account facoltativo: Feega Cloud non si offre a chi non ha fatto login', () => {
  it('senza account non c’è nessuna scelta Feega Cloud né un’AI integrata promessa', () => {
    const body = account(null);

    expect(body).not.toContain('type="radio"');
    expect(body).not.toContain('onboarding-home-cloud');
    expect(body).not.toMatch(/built-in AI that/);
    expect(body).toContain('optional');
    expect(body).toContain('data-testid="onboarding-connect"');
    expect(body).toContain('continue without an account');
  });

  it('dice che la chat usa l’assistente già installato, senza crediti feega', () => {
    expect(account(null)).toMatch(/no feega credits/);
  });

  it('collegato, mostra l’account e prosegue', () => {
    const body = account('ada@example.com');

    expect(body).toContain('connected as ada@example.com');
    expect(body).not.toContain('data-testid="onboarding-connect"');
  });
});
