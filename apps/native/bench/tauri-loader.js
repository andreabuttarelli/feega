window.addEventListener('DOMContentLoaded', () =>
  setTimeout(() => {
    if (location.pathname !== '/changelog') {
      return;
    }
    window.__benchLabel = 'tauri-wkwebview';
    const script = document.createElement('script');
    script.src = 'http://localhost:5199/bench.js';
    document.head.appendChild(script);
  }, 2000)
);
