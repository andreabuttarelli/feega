import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { Connection } from '$lib/onboarding/session.svelte';
import { Place } from '$lib/onboarding/flow';
import StepHome from './StepHome.svelte';
import StepAccount from './StepAccount.svelte';

const home = (place: Place, email: string | null = 'ada@example.com') => render(StepHome, { props: { place, email, oncontinue: () => {}, oncloud: () => {}, onsignin: () => {} } }).body;
const account = (email: string | null) => render(StepAccount, { props: { email, connection: Connection.Idle, onconnect: () => {}, oncontinue: () => {} } }).body;
const cloudRadio = (body: string) => body.match(/<input[^>]*value="cloud"[^>]*>/)?.[0] ?? '';

describe('dove vive il lavoro: si sceglie con un clic, non passandoci sopra', () => {
  it('ogni posto è una scelta radio, e quella scelta è spuntata', () => {
    const body = home(Place.Cloud);

    expect(body.match(/type="radio"/g)).toHaveLength(2);
    expect(cloudRadio(body)).toContain('checked');
  });

  it('con Feega Cloud scelto il bottone apre feega cloud', () => {
    expect(home(Place.Cloud)).toContain('open feega cloud');
    expect(home(Place.Computer)).toContain('continue on this computer');
  });
});

describe('Feega Cloud si vede sempre, ma si sceglie solo dopo il login', () => {
  it('saltato il login, Feega Cloud è visibile e disabilitato, con il perché e la strada per entrare', () => {
    const body = home(Place.Computer, null);

    expect(body).toContain('data-testid="onboarding-home-cloud"');
    expect(cloudRadio(body)).toContain('disabled');
    expect(body).toContain('sign in to use Feega Cloud');
    expect(body).toContain('data-testid="onboarding-signin"');
    expect(body).toContain('continue on this computer');
  });

  it('dopo il login, Feega Cloud è una radio abilitata nello stesso gruppo, scelta da clic e frecce', () => {
    const body = home(Place.Computer, 'ada@example.com');

    expect(cloudRadio(body)).not.toContain('disabled');
    expect(cloudRadio(body)).toContain('name="place"');
    expect(body).not.toContain('data-testid="onboarding-signin"');
    expect(body).toContain('connected as ada@example.com');
  });
});

describe('login facoltativo, prima schermata, con salta', () => {
  it('senza account offre il login e un salta, e nessuna scelta di posto', () => {
    const body = account(null);

    expect(body).not.toContain('type="radio"');
    expect(body).toContain('data-testid="onboarding-connect"');
    expect(body).toMatch(/data-testid="onboarding-continue"[^>]*>skip</);
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
