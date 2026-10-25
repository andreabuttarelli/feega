export enum CloudMode {
  Import = 'import',
  Export = 'export'
}

export type CloudProviderId = 'google_drive' | 'dropbox';

export const PROVIDER_LABEL: Record<CloudProviderId, string> = { google_drive: 'Google Drive', dropbox: 'Dropbox' };

export const CLOUD_PROVIDERS: readonly CloudProviderId[] = ['google_drive', 'dropbox'];
