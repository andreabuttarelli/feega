export const BADGE_SCRIPT = `(() => {
  if (window.self !== window.top) return;
  window.demoBadge = (label) => {
    const badge = document.createElement('div');
    badge.textContent = label;
    badge.style.cssText = 'position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:2147483647;pointer-events:none;padding:14px 26px;border-radius:10px;background:rgba(10,10,10,.88);color:#fff;font:600 40px/1 system-ui;letter-spacing:.04em;transition:opacity .3s';
    document.documentElement.appendChild(badge);
    setTimeout(() => { badge.style.opacity = '0'; }, 1400);
    setTimeout(() => badge.remove(), 1800);
  };
})();`;
