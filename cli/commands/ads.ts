import { loadSession } from '../lib/auth.ts';
import { api } from '../lib/api.ts';
import { ok, warn, table, section, info } from '../lib/display.ts';

const RUNNING_FLAGS = [
  { flag: 'pause', next: 'paused' },
  { flag: 'resume', next: 'active' }
] as const;

export async function cmdAds(slug: string, opts: { approve?: string; pause?: string; resume?: string }) {
  const session = await loadSession();
  if (!session) {
    console.error('Session expired or missing. Run: feega login');
    process.exit(1);
  }
  const token = session.access_token;

  if (opts.approve) {
    const r = await api.approveAdCampaign(token, opts.approve);
    if (!r.campaign) {
      warn(r.message ?? r.error ?? 'approve_failed');
      process.exit(1);
    }
    ok(`Approved ${r.campaign.name} → ${r.campaign.status}`);
    return;
  }

  const running = RUNNING_FLAGS.find((r) => opts[r.flag]);
  if (running) {
    const r = await api.setAdCampaignStatus(token, opts[running.flag]!, running.next);
    if (!r.ok) {
      warn(r.detail ?? r.error ?? 'status_failed');
      process.exit(1);
    }
    ok(`Campaign ${running.next}`);
    return;
  }

  const { brand } = await api.getBrand(token, slug);
  const { campaigns } = await api.listAdCampaigns(token, brand.id);
  section(`Meta ads · ${brand.name}`);
  if (!campaigns.length) {
    info('No campaigns yet. Promote canvas content from the app to propose one.');
    return;
  }
  table(
    ['id', 'name', 'status', 'objective', 'budget'],
    campaigns.map((c) => [c.id.slice(0, 8), c.name, c.status, c.objective, `${c.budgetAmount} ${c.budgetType}`])
  );
}
