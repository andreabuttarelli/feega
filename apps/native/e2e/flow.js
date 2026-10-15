(async () => {
  const COLLECTOR = 'http://localhost:5198';
  const LOGIN_ONCE = 'feega-e2e-login';
  const OPEN_ONCE = 'feega-e2e-open';

  const report = (step, extra = {}) =>
    fetch(`${COLLECTOR}/report`, { method: 'POST', body: JSON.stringify({ step, ms: Math.round(performance.now()), href: location.href, ...extra }) });

  const until = async (selector, timeoutMs = 30_000) => {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      const found = document.querySelector(selector);
      if (found) {
        return found;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`timeout waiting for ${selector}`);
  };

  const bundled = location.protocol === 'tauri:' || location.hostname === 'tauri.localhost';

  try {
    if (bundled && location.pathname === '/login' && !sessionStorage.getItem(LOGIN_ONCE)) {
      sessionStorage.setItem(LOGIN_ONCE, '1');
      const credentials = await (await fetch(`${COLLECTOR}/credentials`)).json();
      (await until('input[type="email"]')).value = credentials.email;
      (await until('input[name="password"]')).value = credentials.password;
      (await until('form.email-form button[type="submit"]')).click();
      await report('login submitted');
      return;
    }

    if (bundled && location.pathname === '/app') {
      const card = await until('[data-testid="home-recents"] [data-testid="canvas-card"]');
      await report('dashboard rendered', { ua: navigator.userAgent });
      if (sessionStorage.getItem(OPEN_ONCE)) {
        return;
      }
      sessionStorage.setItem(OPEN_ONCE, '1');
      await report('opening canvas', { target: card.getAttribute('href') });
      card.click();
      return;
    }

    if (!bundled && location.pathname.startsWith('/p/')) {
      await until('[data-testid="add-bar"]', 60_000);
      await report('hosted canvas signed in');
    }
  } catch (error) {
    await report('failed', { error: String(error) });
  }
})();
