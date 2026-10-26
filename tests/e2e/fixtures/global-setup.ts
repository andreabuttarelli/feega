import { startMockImages } from './mock-images';

const MOCK_IMAGES_PORT = 4498;

/** Il valore di ritorno è la funzione di teardown: Playwright la chiama da sola a fine corsa —
 *  un file solo, un'esportazione sola, niente da tenere sincronizzato con globalTeardown. */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const images = process.env.E2E_FAKE_IMAGES ? await startMockImages(MOCK_IMAGES_PORT) : null;
  if (images) {
    process.env.LLM_BASE_URL = images.url;
  }

  return async () => {
    await images?.close();
  };
}
