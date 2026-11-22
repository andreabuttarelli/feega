const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

export type Fetcher = (url: string) => Promise<Uint8Array>;

export const httpFetcher =
  (send: typeof fetch = fetch): Fetcher =>
  async (url) => {
    const response = await send(url);
    if (!response.ok) {
      throw new Error(`${response.status} from ${url}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_DOWNLOAD_BYTES) {
      throw new Error(`${url} is larger than ${MAX_DOWNLOAD_BYTES / 1024 / 1024} MB`);
    }
    return bytes;
  };
