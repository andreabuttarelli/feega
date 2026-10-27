import { describe, expect, it } from 'vitest';
import { CloudMode, cloudFailure } from './cloud-picker';
import { CONNECTION_MESSAGE, ConnectionError } from './connection-messages';

describe('what a failed import or export says', () => {
  it('names the refusal of a provider download', () => {
    expect(cloudFailure(CloudMode.Import, 'download_failed')).toBe(CONNECTION_MESSAGE[ConnectionError.DownloadFailed]);
  });

  it('asks to connect when there is no connection', () => {
    expect(cloudFailure(CloudMode.Export, 'not_connected')).toBe(CONNECTION_MESSAGE[ConnectionError.NotConnected]);
  });

  it('keeps a readable message the upload check wrote', () => {
    expect(cloudFailure(CloudMode.Import, 'Image is over 4 MB')).toBe('Image is over 4 MB');
  });

  it('says what stage failed when the code is unknown or missing', () => {
    expect(cloudFailure(CloudMode.Import, undefined)).toBe(CONNECTION_MESSAGE[ConnectionError.DownloadFailed]);
    expect(cloudFailure(CloudMode.Export, 'odd_code')).toBe(CONNECTION_MESSAGE[ConnectionError.UploadFailed]);
  });
});
