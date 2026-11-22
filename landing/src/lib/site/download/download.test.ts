import { describe, expect, it } from 'vitest';
import { DOWNLOAD_PAGE } from './index';
import { DOWNLOAD_PATH, FEEGA_VERSION } from '../links';
import { SITE_PATHS } from '../paths';
import { llmsTxt } from '../llms';
import { downloadJsonLd } from '../structured-data';

describe('download page', () => {
  it('is in the sitemap and llms.txt', () => {
    expect(SITE_PATHS).toContain(DOWNLOAD_PATH);
    expect(llmsTxt()).toContain('feega.app/download');
  });

  it('shows the current version', () => {
    expect(DOWNLOAD_PAGE.version).toBe(`version ${FEEGA_VERSION}`);
  });

  it('declares a free SoftwareApplication with a download url', () => {
    const data = JSON.parse(downloadJsonLd().replace(/<\/?script[^>]*>/g, ''));
    expect(data).toMatchObject({ '@type': 'SoftwareApplication', isAccessibleForFree: true, downloadUrl: 'https://www.feega.app/download' });
  });
});
