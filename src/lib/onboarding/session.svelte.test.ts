import { describe, expect, it, vi } from 'vitest';
import { LOCAL_ACCOUNT_PATH, LOCAL_ONBOARDING_PATH, Step } from './flow';
import { OnboardingSession, type Answer } from './session.svelte';

const CLOUD = 'https://cloud.example';
const ME = { email: 'ada@example.com', name: 'Ada' };

function harness(linked: { now: boolean }) {
  const opened: string[] = [];
  const call = vi.fn(async (path: string, init?: RequestInit): Promise<Answer> => {
    if (path === LOCAL_ONBOARDING_PATH) {
      return { status: 200, body: { seenAt: null, account: linked.now ? ME : null, cloud: CLOUD } };
    }
    if (path === LOCAL_ACCOUNT_PATH && init?.method === 'POST') {
      linked.now = true;
      return { status: 200, body: { url: `${CLOUD}/login` } };
    }
    return { status: 200, body: {} };
  });

  const session = new OnboardingSession({ call, remember: async () => {}, track: () => {}, open: (url) => opened.push(url), wait: async () => {} });
  return { session, opened };
}

describe('onboarding locale: un account facoltativo prima di scegliere dove lavorare', () => {
  it('senza account propone il login per primo, poi la scelta del posto', async () => {
    const { session } = harness({ now: false });
    await session.beginLocal();

    expect(session.plan).toEqual([Step.Account, Step.Home, Step.Agents]);
    expect(session.step).toBe(Step.Account);
  });

  it('collegato a metà, aggiunge la scelta del posto, il nome e la memoria dopo il passo account', async () => {
    const { session, opened } = harness({ now: false });
    await session.beginLocal();
    await session.connect();

    expect(opened).toEqual([`${CLOUD}/login`]);
    expect(session.email).toBe(ME.email);
    expect(session.plan).toEqual([Step.Account, Step.Home, Step.Agents, Step.Memory]);
  });

  it('a login riuscito torna sulla scelta del posto', async () => {
    const { session } = harness({ now: false });
    await session.beginLocal();
    await session.connect();

    expect(session.step).toBe(Step.Home);
  });

  it('scegliere Feega Cloud apre la tela su cloud e va avanti', async () => {
    const { session, opened } = harness({ now: true });
    await session.beginLocal();

    session.openCloud();

    expect(opened).toEqual([CLOUD]);
    expect(session.step).toBe(Step.Agents);
  });
});
