const ARROW = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24"><path d="M4 2.5 L4 19.5 L8.6 15.3 L11.5 21.8 L14.6 20.4 L11.8 14 L18 14 Z" fill="#0a0a0a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

export const CURSOR_SCRIPT = `(() => {
  if (window.self !== window.top) return;
  const mount = () => {
    if (document.getElementById('demo-cursor')) return;
    const style = document.createElement('style');
    style.textContent = '#demo-cursor{position:fixed;left:0;top:0;width:30px;height:30px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);will-change:transform}' +
      '.demo-ripple{position:fixed;z-index:2147483646;pointer-events:none;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(59,130,246,.28);border:2px solid rgba(59,130,246,.85);animation:demo-ripple .55s cubic-bezier(.16,1,.3,1) forwards}' +
      '@keyframes demo-ripple{from{transform:scale(.3);opacity:1}to{transform:scale(1.5);opacity:0}}';
    document.documentElement.appendChild(style);
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.innerHTML = ${JSON.stringify(ARROW)};
    document.documentElement.appendChild(cursor);
    const place = (e) => { cursor.style.transform = 'translate(' + (e.clientX - 4) + 'px,' + (e.clientY - 2) + 'px)'; };
    window.addEventListener('pointermove', place, true);
    window.addEventListener('mousemove', place, true);
    window.addEventListener('pointerdown', (e) => {
      place(e);
      const ripple = document.createElement('div');
      ripple.className = 'demo-ripple';
      ripple.style.left = e.clientX + 'px';
      ripple.style.top = e.clientY + 'px';
      document.documentElement.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    }, true);
    window.demoBadge = (label) => {
      const badge = document.createElement('div');
      badge.textContent = label;
      badge.style.cssText = 'position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:2147483647;pointer-events:none;padding:14px 26px;border-radius:10px;background:rgba(10,10,10,.88);color:#fff;font:600 40px/1 system-ui;letter-spacing:.04em;transition:opacity .3s';
      document.documentElement.appendChild(badge);
      setTimeout(() => { badge.style.opacity = '0'; }, 1400);
      setTimeout(() => badge.remove(), 1800);
    };
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();`;
