import { describe, expect, it } from 'vitest';
import '$lib/i18n';
import { render } from 'svelte/server';
import { Connection } from '$lib/onboarding/session.svelte';
import { Place } from '$lib/onboarding/flow';
import StepHome from './StepHome.svelte';
import StepAccount from './StepAccount.svelte';

const home = (place: Place, email: string | null = 'ada@example.com') => render(StepHome, { props: { place, email, oncontinue: () => {}, oncloud: () => {}, onsignin: () => {} } }).body;
const account = (connection = Connection.Idle) => render(StepAccount, { props: { connection, onconnect: () => {}, onsignin: () => {}, onskip: () => {} } }).body;
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

describe('il primo passo è una login, come quella dell’app, con salta', () => {
  it('ha logo, email e password, Google e GitHub, e il bottone primario è accedi', () => {
    const body = account();

    expect(body).toContain('<svg');
    expect(body).toContain('class="wordmark');
    expect(body).toMatch(/<input[^>]*type="email"/);
    expect(body).toMatch(/<input[^>]*type="password"/);
    expect(body).toContain('Continue with Google');
    expect(body).toContain('Continue with GitHub');
    expect(body).toMatch(/<button[^>]*type="submit"[^>]*>\s*Sign in/);
  });

  it('un solo salta, e nessuna spiegazione delle opzioni: quella sta al passo dopo', () => {
    const body = account();

    expect(body.match(/data-testid="onboarding-skip-signin"/g)).toHaveLength(1);
    expect(body).not.toContain('this computer');
    expect(body).not.toContain('a feega account');
    expect(body).not.toContain('type="radio"');
  });

  it('dice di finire nel browser mentre Google o GitHub aspettano', () => {
    expect(account(Connection.Browser)).toContain('Finish signing in in your browser');
  });

  it('dice quando email o password sono sbagliate', () => {
    expect(account(Connection.Refused)).toContain('Wrong email or password');
    expect(account(Connection.Idle)).not.toContain('Wrong email or password');
  });
});
