import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import type { Contact, DigestCommentRow, NotifyStore, StoredSubscription } from './notify';

const USE_PATH = 'src/lib/server/cloud/notify-db.ts';

type SubscriptionRow = { endpoint: string; user_id: string; keys: { p256dh: string; auth: string } };
type CommentRow = {
  session_id: string;
  author_id: string;
  author_name: string;
  body: string;
  selector: string;
  source_file: string;
  source_line: number;
  share_sessions: { project_name: string; host_user_id: string };
};

function client(): SupabaseClient {
  const use = SERVICE_ROLE_USES.find((candidate) => candidate.path.startsWith(USE_PATH));
  if (!use) {
    throw new Error('cloud notify service role use not declared');
  }

  return createServiceRoleDb(use) as unknown as SupabaseClient;
}

export const dbNotifyStore: NotifyStore = {
  async memberIds(orgId) {
    const { data, error } = await client().from('orgs_members').select('user_id').eq('org_id', orgId);
    if (error) {
      throw error;
    }

    return ((data ?? []) as { user_id: string }[]).map((row) => row.user_id);
  },

  async subscriptionsOf(userIds): Promise<StoredSubscription[]> {
    const { data, error } = await client().from('push_subscriptions').select('endpoint, user_id, keys').in('user_id', userIds);
    if (error) {
      throw error;
    }

    return ((data ?? []) as SubscriptionRow[]).map((row) => ({ endpoint: row.endpoint, userId: row.user_id, keys: row.keys }));
  },

  async dropSubscriptions(endpoints) {
    if (endpoints.length) {
      await client().from('push_subscriptions').delete().in('endpoint', endpoints);
    }
  },

  async commentsBetween(from, to): Promise<DigestCommentRow[]> {
    const { data, error } = await client()
      .from('share_comments')
      .select('session_id, author_id, author_name, body, selector, source_file, source_line, share_sessions!inner(project_name, host_user_id)')
      .is('resolved_at', null)
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString())
      .order('created_at', { ascending: true });
    if (error) {
      throw error;
    }

    return ((data ?? []) as unknown as CommentRow[]).map((row) => ({
      sessionId: row.session_id,
      projectName: row.share_sessions.project_name,
      hostId: row.share_sessions.host_user_id,
      authorId: row.author_id,
      authorName: row.author_name,
      body: row.body,
      selector: row.selector,
      sourceFile: row.source_file,
      sourceLine: row.source_line
    }));
  },

  async contactOf(userId): Promise<Contact | null> {
    const { data } = await client().from('profiles').select('email, name').eq('id', userId).maybeSingle();
    const profile = data as { email: string | null; name: string | null } | null;

    return profile?.email ? { email: profile.email, name: profile.name ?? '' } : null;
  }
};
