import type { User } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import type { Database } from '$lib/database.types';

/**
 * IL PROFILO È LA PERSONA, E IL SUO ID È QUELLO DI AUTH.
 *
 * `profiles.id` referenzia `auth.users(id)`: due id per la stessa persona divergono al primo bug,
 * quindi non ce ne sono due. La riga nasce al primo accesso — la policy `own_profile` la difende
 * con `id = auth.uid()`, per cui l'utente scrive la propria e nessun'altra: qui la chiave anon
 * basta, e la service role non serve.
 */
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export type Profile = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  termsAcceptedAt: string | null;
  termsVersion: string | null;
};

const PROFILE_COLUMNS = 'id, email, name, avatar_url, terms_accepted_at, terms_version';

type ProfileColumns = Pick<
  ProfileRow,
  'id' | 'email' | 'name' | 'avatar_url' | 'terms_accepted_at' | 'terms_version'
>;

function toProfile(row: ProfileColumns): Profile {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    termsAcceptedAt: row.terms_accepted_at,
    termsVersion: row.terms_version
  };
}

/** I nomi che i provider usano per la stessa cosa, dichiarati qui invece che in un `if` per volta. */
const NAME_KEYS = ['full_name', 'name'] as const;
const AVATAR_KEYS = ['avatar_url', 'picture'] as const;

function firstString(metadata: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value) {
      return value;
    }
  }
  return null;
}

export function profileFromAuthUser(user: User): Profile {
  if (!user.email) {
    throw new Error(`utente senza email: profiles.email non la accetta (${user.id})`);
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;

  return {
    id: user.id,
    email: user.email,
    name: firstString(metadata, NAME_KEYS),
    avatarUrl: firstString(metadata, AVATAR_KEYS)
  };
}

export async function ensureProfile(db: Db, user: User): Promise<Profile> {
  const profile = profileFromAuthUser(user);

  const { data, error } = await db
    .from('profiles')
    .upsert(
      {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatar_url: profile.avatarUrl,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    )
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }
  return toProfile(data);
}

export async function recordTermsAcceptance(db: Db, userId: string, version: string): Promise<void> {
  const { error } = await db
    .from('profiles')
    .update({ terms_accepted_at: new Date().toISOString(), terms_version: version })
    .eq('id', userId);

  if (error) {
    throw error;
  }
}

export async function claimCampaignTemplate(db: Db, userId: string, campaign: string): Promise<boolean> {
  const { data, error } = await db
    .from('profiles')
    .update({ signup_campaign: campaign, campaign_template_at: new Date().toISOString() })
    .eq('id', userId)
    .is('campaign_template_at', null)
    .select('id');

  if (error) {
    throw error;
  }
  return (data ?? []).length > 0;
}

export type FirstRun = { signupCampaign: string | null; onboardingStatus: string | null };

export async function readFirstRun(db: Db, userId: string): Promise<FirstRun> {
  const { data, error } = await db
    .from('profiles')
    .select('signup_campaign, onboarding_status')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return { signupCampaign: data?.signup_campaign ?? null, onboardingStatus: data?.onboarding_status ?? null };
}

export enum TourWrite {
  Saved = 'saved',
  NoColumn = 'no_column'
}

const MISSING_COLUMN_CODES = new Set(['42703', 'PGRST204']);

const isMissingColumn = (error: { code?: string } | null) => MISSING_COLUMN_CODES.has(error?.code ?? '');

export async function readTourSeen(db: Db, userId: string): Promise<{ seenAt: string | null } | null> {
  const { data, error } = await db.from('profiles').select('onboarding_seen_at').eq('id', userId).maybeSingle();

  if (isMissingColumn(error)) {
    console.warn('[tour] profiles.onboarding_seen_at missing: apply 20261010180000_onboarding_seen.sql');
    return null;
  }
  if (error) {
    throw error;
  }
  return { seenAt: data?.onboarding_seen_at ?? null };
}

export async function markTourSeen(db: Db, userId: string): Promise<TourWrite> {
  const { error } = await db.from('profiles').update({ onboarding_seen_at: new Date().toISOString() }).eq('id', userId);

  if (isMissingColumn(error)) {
    console.warn('[tour] profiles.onboarding_seen_at missing: seen kept in the browser only');
    return TourWrite.NoColumn;
  }
  if (error) {
    throw error;
  }
  return TourWrite.Saved;
}

export async function moveOnboarding(db: Db, userId: string, input: { from: string | null; to: string }): Promise<boolean> {
  const update = db.from('profiles').update({ onboarding_status: input.to }).eq('id', userId);
  const guarded = input.from === null ? update.is('onboarding_status', null) : update.eq('onboarding_status', input.from);
  const { data, error } = await guarded.select('id');

  if (error) {
    throw error;
  }
  return (data ?? []).length > 0;
}
