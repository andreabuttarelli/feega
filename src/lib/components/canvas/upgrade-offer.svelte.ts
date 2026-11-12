import { offerPath, type OfferReason } from '$lib/upgrade-offer';

type OfferReply = { state: string; expiresAt?: number };

class UpgradeOffer {
  expiresAt = $state<number | null>(null);
  projectId = $state('');
  dismissed = $state(false);
  #asked = false;

  async show(projectId: string, reason: OfferReason, fetcher: typeof fetch = fetch) {
    if (this.#asked || this.dismissed || !projectId) {
      return;
    }
    this.#asked = true;

    const res = await fetcher(offerPath(projectId), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason }) }).catch(() => null);
    const reply = (await res?.json().catch(() => null)) as OfferReply | null;
    if (!reply?.expiresAt) {
      return;
    }
    this.projectId = projectId;
    this.expiresAt = reply.expiresAt;
  }

  dismiss() {
    this.dismissed = true;
  }
}

export const upgradeOffer = new UpgradeOffer();
