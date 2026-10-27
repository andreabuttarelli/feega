import { ConnectionError, connectionMessage } from './connection-messages';

export enum CloudMode {
  Import = 'import',
  Export = 'export'
}

export type CloudProviderId = 'google_drive' | 'dropbox';

export const PROVIDER_LABEL: Record<CloudProviderId, string> = { google_drive: 'Google Drive', dropbox: 'Dropbox' };

export const CLOUD_PROVIDERS: readonly CloudProviderId[] = ['google_drive', 'dropbox'];

const FAILED_AT: Record<CloudMode, ConnectionError> = {
  [CloudMode.Import]: ConnectionError.DownloadFailed,
  [CloudMode.Export]: ConnectionError.UploadFailed
};

const SENTENCE = /\s/;

export function cloudFailure(mode: CloudMode, code: string | undefined): string {
  if (code && SENTENCE.test(code)) {
    return code;
  }
  return connectionMessage(code, FAILED_AT[mode]);
}

export enum CloudAction {
  Connect = 'connect',
  Status = 'status',
  ListFiles = 'list_files',
  Import = 'import',
  Export = 'export',
  Disconnect = 'disconnect'
}

export enum FigmaTokenAction {
  Save = 'save',
  Test = 'test',
  Remove = 'remove',
  Status = 'status'
}
