import type { User } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import type { Database } from '$lib/database.types';
import { isGithubProvider } from '$lib/onboarding/provider-name';

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
    name: isGithubProvider(user) ? null : firstString(metadata, NAME_KEYS),
    avatarUrl: firstString(metadata, AVATAR_KEYS),
    termsAcceptedAt: null,
    termsVersion: null
  };
}

async function readProfile(db: Db, userId: string): Promise<ProfileColumns | null> {
  const { data, error } = await db.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle();
  if (error) {
    throw error;
  }
  return data;
}

async function createProfile(db: Db, profile: Profile): Promise<ProfileColumns> {
  const { error } = await db
    .from('profiles')
    .upsert({ id: profile.id, email: profile.email, name: profile.name, avatar_url: profile.avatarUrl }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) {
    throw error;
  }
  const created = await readProfile(db, profile.id);
  if (!created) {
    throw new Error(`profilo non creato (${profile.id})`);
  }
  return created;
}

function emptyFilled(row: ProfileColumns, fromAuth: Profile): Partial<Pick<ProfileColumns, 'name' | 'avatar_url'>> {
  const patch: Partial<Pick<ProfileColumns, 'name' | 'avatar_url'>> = {};
  if (!row.name && fromAuth.name) {
    patch.name = fromAuth.name;
  }
  if (!row.avatar_url && fromAuth.avatarUrl) {
    patch.avatar_url = fromAuth.avatarUrl;
  }
  return patch;
}

export async function ensureProfile(db: Db, user: User): Promise<Profile> {
  const fromAuth = profileFromAuthUser(user);
  const row = (await readProfile(db, user.id)) ?? (await createProfile(db, fromAuth));

  const patch = emptyFilled(row, fromAuth);
  if (Object.keys(patch).length === 0) {
    return toProfile(row);
  }

  const { error } = await db
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) {
    throw error;
  }
  return toProfile({ ...row, ...patch });
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

export async function saveName(db: Db, userId: string, name: string): Promise<void> {
  const { error } = await db.from('profiles').update({ name, updated_at: new Date().toISOString() }).eq('id', userId);

  if (error) {
    throw error;
  }
}
