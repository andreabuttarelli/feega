import { Toolkit, type ProviderCall } from './account-links';

export const CONNECT_CALLBACK = '/api/v1/connections/callback';

type ToolkitRow = { label: string; identity: ProviderCall; handle: (data: Record<string, unknown>) => unknown };

export const TOOLKITS: Record<Toolkit, ToolkitRow> = {
  [Toolkit.GitHub]: { label: 'GitHub', identity: { endpoint: '/user' }, handle: (d) => d.login },
  [Toolkit.Figma]: { label: 'Figma', identity: { endpoint: 'https://api.figma.com/v1/me' }, handle: (d) => d.handle },
  [Toolkit.GoogleDrive]: { label: 'Google Drive', identity: { endpoint: 'https://www.googleapis.com/drive/v3/about', query: { fields: 'user' } }, handle: (d) => (d.user as { emailAddress?: string } | undefined)?.emailAddress },
  [Toolkit.Dropbox]: { label: 'Dropbox', identity: { endpoint: 'https://api.dropboxapi.com/2/users/get_current_account', method: 'POST' }, handle: (d) => d.email },
  [Toolkit.OneDrive]: { label: 'OneDrive', identity: { endpoint: 'https://graph.microsoft.com/v1.0/me' }, handle: (d) => d.userPrincipalName }
};

export const isToolkit = (value: string): value is Toolkit => Object.values(Toolkit).includes(value as Toolkit);

export function handleOf(toolkit: Toolkit, data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const handle = TOOLKITS[toolkit].handle(data as Record<string, unknown>);
  return typeof handle === 'string' && handle !== '' ? handle : null;
}
