import { swallow } from '$lib/server/swallow';
import { hasManyTenants } from '$lib/server/tenancy';
import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { syncBrandAccounts, disconnectAccount } from '$lib/server/zernio';
import { canAffordSeat } from '$lib/server/social-connections';
import { rungFor } from '$lib/credit-ladder';
import { generateApiKey } from '$lib/server/cli-auth';
import { sendEmail, brandInviteEmailSubject, brandInviteEmailHtml, brandInviteEmailText } from '$lib/server/email';
import { emailLocale } from '$lib/server/email-i18n';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestEvent } from '@sveltejs/kit';
import { invalidateBrandNav } from '$lib/server/nav-cache';
import { readUploadImage } from '$lib/server/raster-image';
import { isOrgOwner, orgBillingById } from '$lib/server/org-billing';
import { portalLink } from '$lib/server/billing-links';
import { billingGrantsReady } from '$lib/server/billing-readiness';
import { BILLING_PATH, checkoutReturnUrls } from '$lib/billing-path';
import { listMemberships } from '$lib/server/repos/orgs';
import { chooseOrg, ORG_COOKIE } from '$lib/server/tenancy/context';
import type { Db } from '$lib/server/db/client';
import { appOrigin } from '$lib/server/app-url';

const stripeApi = () => import('$lib/server/stripe');

type SettingsBrand = { id: string; slug: string; name: string; org_id: string; zernio_profile_id: string | null };

export type SettingsScope = { projectId: string; orgId: string; brand: SettingsBrand | null };

export async function settingsScope(supabase: SupabaseClient, projectId: string): Promise<SettingsScope | null> {
  const { data: project } = await supabase
    .from('projects')
    .select('org_id, brand_id')
    .eq('id', projectId)
    .is('archived_at', null)
    .maybeSingle();
  if (!project) return null;
  if (!project.brand_id) return { projectId, orgId: project.org_id, brand: null };

  const { data: brand } = await supabase
    .from('brands')
    .select('id, slug, name, org_id, zernio_profile_id')
    .eq('id', project.brand_id)
    .eq('org_id', project.org_id)
    .maybeSingle();
  return { projectId, orgId: project.org_id, brand: (brand as SettingsBrand | null) ?? null };
}

async function scopeOf({ params, locals: { supabase } }: RequestEvent) {
  return settingsScope(supabase, params.projectId ?? '');
}

async function isOwnerOf(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return false;
  return isOrgOwner(supabase, orgId, user.id);
}

async function ownedScope(event: RequestEvent): Promise<SettingsScope | null> {
  const scope = await scopeOf(event);
  if (!scope) return null;
  return (await isOwnerOf(event.locals.supabase, scope.orgId)) ? scope : null;
}

const OWNER_ROLE = 'owner';

async function ownedOrgId({ cookies, locals: { supabase } }: RequestEvent): Promise<string | null> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const membership = chooseOrg(await listMemberships(supabase as Db, user.id), cookies.get(ORG_COOKIE) ?? null);
  return membership?.role === OWNER_ROLE ? membership.org.id : null;
}

const billingUrl = (event: RequestEvent) => `${appOrigin(event.url)}${BILLING_PATH}`;

const FEEDBACK: Record<string, string> = {
  too_expensive: 'too_expensive',
  unused: 'unused',
  missing_features: 'missing_features',
  switched_service: 'switched_service',
  other: 'other'
};

type Ev = RequestEvent;

export async function billingPortal(event: Ev) {
  const orgId = await ownedOrgId(event);
  if (!orgId) return fail(403, { billingError: 'Owner only' });
  const data = await event.request.formData();
  const flowRaw = String(data.get('flow') ?? 'invoices');
  const flow = flowRaw === 'payment_method' || flowRaw === 'upgrade' ? flowRaw : undefined;

  const link = await portalLink(await orgBillingById(event.locals.supabase, orgId), {
    returnUrl: billingUrl(event),
    flow
  });
  if (link.refusal === 'no_org_billing') return fail(404, { billingError: 'Organization not found' });
  if (link.refusal === 'no_customer' || link.refusal === 'no_subscription') {
    return fail(400, { billingError: 'No billing account yet' });
  }
  if (link.refusal) return fail(500, { billingError: link.message || 'Could not open billing' });

  throw redirect(303, link.url);
}

const PURCHASES_NOT_READY = 'Purchases open soon.';

export async function upgrade(event: Ev) {
  const orgId = await ownedOrgId(event);
  if (!orgId) return fail(403, { billingError: 'Owner only' });
  const { supabase } = event.locals;
  if (!(await billingGrantsReady(supabase))) return fail(409, { billingError: PURCHASES_NOT_READY });
  const data = await event.request.formData();
  const usd = Number(data.get('usd') ?? '');

  const rung = rungFor(usd);
  if (!rung) return fail(400, { billingError: 'Unknown subscription tier' });

  const billing = await orgBillingById(supabase, orgId);
  if (!billing) return fail(404, { billingError: 'Organization not found' });

  const returnUrl = billingUrl(event);

  if (!billing.subscriptionId) {
    const { subscriptionPriceIdFor, ensureOrgCustomer, createSubscriptionCheckout } = await stripeApi();
    let checkoutUrl: string;
    try {
      const priceId = await subscriptionPriceIdFor(rung.price);
      if (!priceId) {
        return fail(400, { billingError: 'Subscriptions are not configured yet for this tier.' });
      }
      const customerId = await ensureOrgCustomer({
        id: billing.orgId,
        name: billing.orgName,
        stripe_customer_id: billing.customerId
      });
      checkoutUrl = await createSubscriptionCheckout({
        customerId,
        orgId: billing.orgId,
        priceId,
        credits: rung.credits,
        ...checkoutReturnUrls(returnUrl)
      });
    } catch (e) {
      return fail(500, { billingError: e instanceof Error ? e.message : 'Could not start the upgrade' });
    }
    throw redirect(303, checkoutUrl);
  }

  const link = await portalLink(billing, { returnUrl, flow: 'upgrade' });
  if (link.refusal) return fail(500, { billingError: link.message || 'Could not start the upgrade' });

  throw redirect(303, link.url);
}

export async function applyRetention(event: Ev) {
  const orgId = await ownedOrgId(event);
  if (!orgId) return fail(403, { billingError: 'Owner only' });
  const coupon = env.STRIPE_RETENTION_COUPON;
  if (!coupon) return fail(400, { billingError: 'Retention offer is not configured.' });

  const billing = await orgBillingById(event.locals.supabase, orgId);
  if (!billing?.subscriptionId) return fail(400, { billingError: 'No active subscription.' });

  try {
    const { applyRetentionCoupon } = await stripeApi();
    await applyRetentionCoupon(billing.subscriptionId, coupon);
  } catch (e) {
    return fail(500, { billingError: e instanceof Error ? e.message : 'Could not apply the offer' });
  }
  return { retentionApplied: true };
}

export async function cancelPlan(event: Ev) {
  const orgId = await ownedOrgId(event);
  if (!orgId) return fail(403, { billingError: 'Owner only' });
  const data = await event.request.formData();
  const reason = String(data.get('reason') ?? '');
  const comment = String(data.get('explanation') ?? '').trim();

  const billing = await orgBillingById(event.locals.supabase, orgId);
  if (!billing?.subscriptionId) return fail(400, { billingError: 'No active subscription.' });

  let endsAt: string | null = null;
  try {
    const { cancelSubscriptionAtPeriodEnd } = await stripeApi();
    ({ endsAt } = await cancelSubscriptionAtPeriodEnd(billing.subscriptionId, {
      feedback: FEEDBACK[reason],
      comment
    }));
  } catch (e) {
    return fail(500, { billingError: e instanceof Error ? e.message : 'Could not cancel the plan' });
  }
  return { canceled: true, endsAt };
}

export async function buyOneTime(event: Ev) {
  const orgId = await ownedOrgId(event);
  if (!orgId) return fail(403, { billingError: 'Owner only' });
  const { supabase } = event.locals;
  if (!(await billingGrantsReady(supabase))) return fail(409, { billingError: PURCHASES_NOT_READY });

  const rung = rungFor(Number((await event.request.formData()).get('usd') ?? ''));
  if (!rung) return fail(400, { billingError: 'Unknown one-time pack' });

  const billing = await orgBillingById(supabase, orgId);
  if (!billing) return fail(404, { billingError: 'Organization not found' });

  let checkoutUrl: string;
  try {
    const { ensureOrgCustomer, createOneTimeCreditCheckout } = await stripeApi();
    const customerId = await ensureOrgCustomer({
      id: billing.orgId,
      name: billing.orgName,
      stripe_customer_id: billing.customerId
    });
    checkoutUrl = await createOneTimeCreditCheckout({
      customerId,
      orgId: billing.orgId,
      price: rung.price,
      credits: rung.credits,
      ...checkoutReturnUrls(billingUrl(event))
    });
  } catch (e) {
    return fail(500, { billingError: e instanceof Error ? e.message : 'Could not start the purchase' });
  }
  throw redirect(303, checkoutUrl);
}

export async function deleteBrand(event: Ev) {
  const scope = await ownedScope(event);
  if (!scope) return fail(403, { deleteError: 'failed' });
  const brand = scope.brand;
  if (!brand) return fail(404, { deleteError: 'failed' });
  const { supabase } = event.locals;
  const confirm = String((await event.request.formData()).get('confirm') ?? '').trim();
  if (confirm !== brand.name) return fail(400, { deleteError: 'nameMismatch' });

  const billing = await orgBillingById(supabase, scope.orgId);
  if (billing?.subscriptionId && billing.brandCount <= 1) {
    try {
      const { ensureSubscriptionCanceled } = await stripeApi();
      await ensureSubscriptionCanceled(billing.subscriptionId);
    } catch (e) {
      return fail(400, {
        deleteError: e instanceof Error && e.message === 'active_plan' ? 'activePlan' : 'failed'
      });
    }
  }

  const { data: accounts } = await supabase
    .from('social_accounts')
    .select('zernio_account_id')
    .eq('brand_id', brand.id);
  for (const a of accounts ?? []) {
    if (a.zernio_account_id) await disconnectAccount(a.zernio_account_id).catch(swallow('disconnect zernio account'));
  }

  if (!hasManyTenants()) return fail(404, { deleteError: 'not_found' });

  const { error } = await supabase.from('brands').delete().eq('id', brand.id).eq('org_id', scope.orgId);
  if (error) return fail(500, { deleteError: 'failed' });
  invalidateBrandNav(brand.slug);
  throw redirect(303, `/p/${scope.projectId}/settings/brand`);
}

export async function sync(event: Ev) {
  const brand = (await scopeOf(event))?.brand;
  if (!brand) return { error: 'Brand not found' };
  const { supabase } = event.locals;
  if (!(await canAffordSeat(supabase, brand.org_id))) {
    return { error: 'Not enough credits for this month\'s account fee' };
  }
  try {
    await syncBrandAccounts(supabase, brand);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Sync failed' };
  }
  return { synced: true };
}

export async function disconnect(event: Ev) {
  const id = String((await event.request.formData()).get('id') ?? '');
  if (!id) return { error: 'Missing account' };

  const brand = (await scopeOf(event))?.brand;
  if (!brand) return { error: 'Brand not found' };
  const { supabase } = event.locals;

  const { data: acc } = await supabase
    .from('social_accounts')
    .select('id, zernio_account_id')
    .eq('id', id)
    .eq('brand_id', brand.id)
    .maybeSingle();
  if (!acc) return { error: 'Account not found' };

  try {
    await disconnectAccount(acc.zernio_account_id);
  } catch (error) { swallow('disconnect zernio account', error); }
  await supabase.from('social_accounts').delete().eq('id', acc.id).eq('brand_id', brand.id);
  invalidateBrandNav(brand.slug);
  return { disconnected: true };
}

export async function invite(event: Ev) {
  const { request, url, cookies, locals: { supabase } } = event;
  const fd = await request.formData();
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, { teamError: 'Invalid email' });

  const scope = await scopeOf(event);
  if (!scope) return fail(404, { teamError: 'Project not found' });

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return fail(401, { teamError: 'Not authenticated' });
  if (email === user.email?.toLowerCase()) return fail(400, { teamError: 'That’s you' });

  const { createInvite } = await import('$lib/server/repos/invites');
  let token: string;
  try {
    ({ token } = await createInvite(supabase, {
      orgId: scope.orgId,
      email,
      role: 'member',
      invitedBy: user.id
    }));
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    const message = e instanceof Error ? e.message : 'Could not create the invite';
    return fail(400, { teamError: code === '23505' ? 'Already invited' : message });
  }

  let emailSent = true;
  try {
    const locale = emailLocale(cookies.get('locale'));
    const inviter = user.email ?? 'A teammate';
    const teamName = scope.brand?.name ?? 'feega';
    const acceptUrl = `${url.origin}/login?invite_token=${encodeURIComponent(token)}`;
    await sendEmail({
      to: email,
      subject: brandInviteEmailSubject(locale, teamName, inviter),
      html: brandInviteEmailHtml(locale, teamName, inviter, email, acceptUrl, url.origin),
      text: brandInviteEmailText(locale, teamName, inviter, email, acceptUrl)
    });
  } catch {
    emailSent = false;
  }
  return { teamInvited: true, emailSent };
}

export async function revokeInvite(event: Ev) {
  const id = String((await event.request.formData()).get('invite_id') ?? '');
  if (!id) return fail(400, { teamError: 'Missing invite' });

  const scope = await scopeOf(event);
  if (!scope) return fail(404, { teamError: 'Project not found' });

  const { revokeInvite: revokeInviteRepo } = await import('$lib/server/repos/invites');
  try {
    await revokeInviteRepo(event.locals.supabase, { orgId: scope.orgId, inviteId: id });
  } catch (e) {
    return fail(500, { teamError: e instanceof Error ? e.message : 'Could not revoke the invite' });
  }
  return { teamRevoked: true };
}

export async function createApiKey(event: Ev) {
  const data = await event.request.formData();
  const name = String(data.get('key_name') ?? '').trim() || 'API Key';
  const writeAccess = String(data.get('write') ?? '') === 'true';

  const scope = await scopeOf(event);
  if (!scope) return fail(404, { apiKeyError: 'Project not found' });
  const { supabase } = event.locals;

  const { raw, hash, prefix } = await generateApiKey();
  const scopes = writeAccess ? ['read', 'write'] : ['read'];

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return fail(401, { apiKeyError: 'Not authenticated' });

  const { error } = await supabase
    .from('api_keys')
    .insert({ org_id: scope.orgId, user_id: user.id, name, key_hash: hash, key_prefix: prefix, scopes });

  if (error) return fail(500, { apiKeyError: error.message });

  return { apiKeyCreated: true, apiKeyRaw: raw, apiKeyName: name };
}

export async function revokeApiKey(event: Ev) {
  const id = String((await event.request.formData()).get('key_id') ?? '');
  if (!id) return fail(400, { apiKeyError: 'Missing key ID' });

  const scope = await scopeOf(event);
  if (!scope) return fail(404, { apiKeyError: 'Project not found' });

  const { error } = await event.locals.supabase.from('api_keys').delete().eq('id', id).eq('org_id', scope.orgId);
  if (error) return fail(500, { apiKeyError: error.message });

  return { apiKeyRevoked: true };
}

/** Update the signed-in user's display name (first + last → profiles.full_name). */
export async function updateProfile({
  request,
  locals: { supabase, safeGetSession }
}: Ev) {
  const { user } = await safeGetSession();
  if (!user) return fail(401, { error: 'unauthorized' });
  const fd = await request.formData();
  const firstName = String(fd.get('firstName') ?? '')
    .trim()
    .slice(0, 80);
  const lastName = String(fd.get('lastName') ?? '')
    .trim()
    .slice(0, 80);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').slice(0, 160);
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName || null })
    .eq('id', user.id);
  if (error) return fail(500, { error: error.message });
  return { profileSaved: true };
}

/** Upload / replace the signed-in user's profile photo → profiles.avatar_url. */
export async function uploadProfileAvatar({
  request,
  locals: { supabase, safeGetSession }
}: Ev) {
  const { user } = await safeGetSession();
  if (!user) return fail(401, { error: 'unauthorized' });
  const fd = await request.formData();
  const file = fd.get('avatar');
  if (!(file instanceof File) || file.size === 0) return fail(400, { error: 'no_file' });
  const img = await readUploadImage(file, { maxOutBytes: 2_000_000 });
  if (!img.ok) return fail(400, { error: img.error === 'too_large' ? 'too_large' : 'not_image' });

  const ext = img.mime.includes('png') ? 'png' : 'jpg';
  const path = `${user.id}/profile/avatar-${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage
    .from('media')
    .upload(path, img.bytes, { contentType: img.mime, upsert: false });
  if (up.error) return fail(500, { error: up.error.message });

  const avatarUrl = supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id);
  if (error) return fail(500, { error: error.message });
  return { avatarUploaded: true };
}

/** Clear profiles.avatar_url (falls back to OAuth picture if any). */
export async function removeProfileAvatar({ locals: { supabase, safeGetSession } }: Ev) {
  const { user } = await safeGetSession();
  if (!user) return fail(401, { error: 'unauthorized' });
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', user.id);
  if (error) return fail(500, { error: error.message });
  return { avatarRemoved: true };
}
