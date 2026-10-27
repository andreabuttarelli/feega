export enum ConnectionError {
  NoToken = 'no_token',
  TokenRejected = 'token_rejected',
  RateLimited = 'rate_limited',
  Unavailable = 'unavailable',
  Invalid = 'invalid',
  NotConnected = 'not_connected',
  Reconnect = 'reconnect',
  NotConfigured = 'not_configured',
  DownloadFailed = 'download_failed',
  UploadFailed = 'upload_failed',
  AssetUnreadable = 'asset_unreadable',
  AssetNotFound = 'asset_not_found',
  Failed = 'failed'
}

export const CONNECTION_MESSAGE: Record<ConnectionError, string> = {
  [ConnectionError.NoToken]: 'Add a Figma token in Settings to import images.',
  [ConnectionError.TokenRejected]: 'Figma refused the token. It may be expired, missing the File content scope, or without access to that file. Check it in Settings.',
  [ConnectionError.RateLimited]: 'Too many Figma image requests. Wait a minute and paste again.',
  [ConnectionError.Unavailable]: 'Figma did not answer. The images stay grey; paste again in a moment.',
  [ConnectionError.Invalid]: 'These Figma images could not be requested.',
  [ConnectionError.NotConnected]: 'Connect the account to continue.',
  [ConnectionError.Reconnect]: 'The connection expired. Connect the account again.',
  [ConnectionError.NotConfigured]: 'This account is not set up on this server.',
  [ConnectionError.DownloadFailed]: 'The provider would not let feega download that file. Check you can open it there.',
  [ConnectionError.UploadFailed]: 'The provider refused the upload. Try another folder.',
  [ConnectionError.AssetUnreadable]: 'feega could not read the file to export. Try again.',
  [ConnectionError.AssetNotFound]: 'That file is no longer in this project.',
  [ConnectionError.Failed]: 'Something went wrong. Try again.'
};

const isKnown = (code: string): code is ConnectionError => code in CONNECTION_MESSAGE;

export function connectionMessage(code: string | null | undefined, fallback: ConnectionError = ConnectionError.Failed): string {
  return CONNECTION_MESSAGE[code && isKnown(code) ? code : fallback];
}
