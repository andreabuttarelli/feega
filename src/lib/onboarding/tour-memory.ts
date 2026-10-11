import { TOUR_SEEN_PATH, TOUR_SEEN_STORAGE_KEY } from './tour';

const SEEN = '1';

export function seenInBrowser(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_STORAGE_KEY) === SEEN;
  } catch {
    return false;
  }
}

function keepInBrowser() {
  try {
    localStorage.setItem(TOUR_SEEN_STORAGE_KEY, SEEN);
  } catch (e) {
    console.warn('[tour] seen not stored in this browser', e);
  }
}

export async function rememberTourSeen(post: typeof fetch = fetch): Promise<void> {
  try {
    const res = await post(TOUR_SEEN_PATH, { method: 'POST' });
    const body = res.ok ? ((await res.json()) as { saved?: boolean }) : {};
    if (body.saved) {
      return;
    }
    console.warn('[tour] seen not saved on the profile, kept in this browser');
  } catch (e) {
    console.warn('[tour] seen not saved on the profile, kept in this browser', e);
  }
  keepInBrowser();
}
