export enum Toolkit {
  GitHub = 'github',
  Figma = 'figma',
  GoogleDrive = 'googledrive',
  Dropbox = 'dropbox',
  OneDrive = 'one_drive'
}

export enum LinkStatus {
  Active = 'active',
  Pending = 'pending',
  Gone = 'gone'
}

export type BinaryBody = { base64: string; contentType: string };

export type ProviderCall = { endpoint: string; query?: Record<string, string>; headers?: Record<string, string>; method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; binary?: BinaryBody };

export type ProviderAnswer = { status: number; data: unknown; headers: Record<string, string>; file: string | null };

export type ProviderCaller = (request: ProviderCall) => Promise<ProviderAnswer>;

export type LinkStarted = { url: string; accountId: string };

export type AccountLinks = {
  link: (owner: string, toolkit: Toolkit, callbackUrl: string) => Promise<LinkStarted>;
  status: (accountId: string) => Promise<LinkStatus>;
  call: (owner: string, accountId: string, request: ProviderCall) => Promise<ProviderAnswer>;
  forget: (accountId: string) => Promise<void>;
};

export const ownerOf = (orgId: string, userId: string) => `${orgId}:${userId}`;
