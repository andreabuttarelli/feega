import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { cancelSubscriptionAtPeriodEnd, ensureSubscriptionCanceled } from '$lib/server/stripe';
import { DeletionOutcome, deleteAccountWith, removeStoragePrefix } from './delete-account';

const DELETE_USE_PATH = 'src/lib/server/account/account-server.ts — deleteAccount';
const RECENT_LOGIN_MS = 15 * 60 * 1000;
const CONFIRM_WORD = 'DELETE';
const HTTP_UNAUTHORIZED = 401;
const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_CONFLICT = 409;
const HTTP_SEE_OTHER = 303;

export enum DeleteError {
  Confirm = 'confirm',
  Reauth = 'reauth',
  Transfer = 'transfer'
}

function serviceDb(): SupabaseClient {
  const use = SERVICE_ROLE_USES.find((u) => u.path === DELETE_USE_PATH);
  if (!use) {
    throw new Error(`uso della service role non dichiarato nel registro: ${DELETE_USE_PATH}`);
  }
  return createServiceRoleDb(use) as unknown as SupabaseClient;
}

async function cancelIfActive(subscriptionId: string) {
  try {
    await ensureSubscriptionCanceled(subscriptionId);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'active_plan') {
      throw error;
    }
    await cancelSubscriptionAtPeriodEnd(subscriptionId, { comment: 'account deleted' });
  }
}

export function deleteAccount(userId: string) {
  const db = serviceDb();
  return deleteAccountWith(
    {
      db,
      removePrefix: (bucket, prefix) => removeStoragePrefix(db, bucket, prefix),
      cancelAtPeriodEnd: cancelIfActive
    },
    userId
  );
}

export function signedInRecently(lastSignInAt: string | null | undefined, now = Date.now()): boolean {
  if (!lastSignInAt) {
    return false;
  }
  return now - new Date(lastSignInAt).getTime() <= RECENT_LOGIN_MS;
}

export async function deleteAccountAction({ request, locals: { supabase, safeGetSession } }: RequestEvent) {
  const { user } = await safeGetSession();
  if (!user) {
    return fail(HTTP_UNAUTHORIZED, { deleteError: DeleteError.Reauth });
  }

  const confirm = String((await request.formData()).get('confirm') ?? '').trim();
  if (confirm !== CONFIRM_WORD && confirm.toLowerCase() !== (user.email ?? '').toLowerCase()) {
    return fail(HTTP_BAD_REQUEST, { deleteError: DeleteError.Confirm });
  }
  if (!signedInRecently(user.last_sign_in_at)) {
    return fail(HTTP_FORBIDDEN, { deleteError: DeleteError.Reauth });
  }

  const result = await deleteAccount(user.id);
  if (result.outcome === DeletionOutcome.TransferRequired) {
    return fail(HTTP_CONFLICT, { deleteError: DeleteError.Transfer, orgIds: result.orgIds });
  }

  await supabase.auth.signOut({ scope: 'local' });
  throw redirect(HTTP_SEE_OTHER, '/login?deleted=1');
}
