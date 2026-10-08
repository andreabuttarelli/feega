export enum PrefillMode {
  Draft = 'draft',
  Send = 'send'
}

export type ChatPrefill = { text: string; at: number; mode?: PrefillMode };
