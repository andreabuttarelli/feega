export enum Toolkit {
  GitHub = 'github'
}

export enum LinkStatus {
  Active = 'active',
  Pending = 'pending',
  Gone = 'gone'
}

export type ProviderCall = { endpoint: string; query?: Record<string, string> };

export type ProviderAnswer = { status: number; data: unknown; headers: Record<string, string>; file: string | null };

export type LinkStarted = { url: string; accountId: string };

export type AccountLinks = {
  link: (owner: string, toolkit: Toolkit, callbackUrl: string) => Promise<LinkStarted>;
  status: (accountId: string) => Promise<LinkStatus>;
  call: (owner: string, accountId: string, request: ProviderCall) => Promise<ProviderAnswer>;
  forget: (accountId: string) => Promise<void>;
};

export const ownerOf = (orgId: string, userId: string) => `${orgId}:${userId}`;
