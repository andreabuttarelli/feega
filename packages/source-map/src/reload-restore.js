const KEY = 'feega:reload-scroll';

const here = (win) => win.location.pathname + win.location.search;

function sessionOf(win) {
  try {
    return win.sessionStorage;
  } catch {
    return null;
  }
}

export function keepScroll(win, storage = sessionOf(win)) {
  let leaving = false;
  if (!storage) {
    return { restored: false, leave: () => (leaving = true) };
  }
  const saved = JSON.parse(storage.getItem(KEY) ?? 'null');
  storage.removeItem(KEY);
  const restored = Boolean(saved && saved.path === here(win));
  if (restored) {
    win.scrollTo(0, saved.y);
    win.addEventListener('load', () => win.scrollTo(0, saved.y), { once: true });
  }

  win.addEventListener('pagehide', () => {
    if (!leaving) {
      storage.setItem(KEY, JSON.stringify({ path: here(win), y: win.scrollY }));
    }
  });

  return {
    restored,
    leave() {
      leaving = true;
    }
  };
}
