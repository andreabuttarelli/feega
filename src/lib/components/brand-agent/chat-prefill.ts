import type { ChatAttachment } from '$lib/chat-attachments';

export enum PrefillMode {
  Draft = 'draft',
  Send = 'send'
}

export type ChatPrefill = { text: string; at: number; mode?: PrefillMode; attachments?: ChatAttachment[] };

export function briefPrefill(text: string, attachments: ChatAttachment[], at: number): ChatPrefill {
  return { text, at, mode: PrefillMode.Send, attachments };
}
