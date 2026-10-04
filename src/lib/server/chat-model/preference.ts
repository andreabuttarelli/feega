import type { ChatModelChoice } from '$lib/chat-model';
import type { AskedChoice } from './catalogue';

const METADATA_KEY = 'chat_model';

type MetadataOwner = { user_metadata?: Record<string, unknown> | null };

type AuthReader = { getUser(): Promise<{ data: { user: MetadataOwner | null } }> };

type AuthWriter = { updateUser(attrs: { data: Record<string, unknown> }): Promise<{ error: unknown }> };

export async function savedChoice(auth: AuthReader): Promise<AskedChoice> {
  const { data } = await auth.getUser();
  const saved = data.user?.user_metadata?.[METADATA_KEY];
  return saved && typeof saved === 'object' ? (saved as AskedChoice) : {};
}

export async function saveChoice(auth: AuthWriter, choice: ChatModelChoice): Promise<boolean> {
  const { error } = await auth.updateUser({ data: { [METADATA_KEY]: choice } });
  return !error;
}
