(async () => {
  if (window.__benchStarted) return;
  window.__benchStarted = true;
  const LABEL = window.__benchLabel || 'unknown';
  const COLLECT = 'http://localhost:5199/result';
  const FORMATS = ['16:9', '9:16', '1:1', '4:5'];
  const ASPECT = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function poster(format, seed) {
    const w = 1080, h = Math.round(1080 / ASPECT[format]);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    let s = seed * 9973 + 1;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const v = 60 + seed * 7 + ((s >> 8) % 80) - 40;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.8);
  }

  try {
    await import(location.origin + '/tests/e2e/fixtures/motion-canvas-harness.ts');
    const nodes = Array.from({ length: 23 }, (_, i) => {
      const format = FORMATS[i % 4];
      return { id: 'n' + i, x: (i % 4) * 520, y: Math.floor(i / 4) * 640, format, poster: poster(format, i) };
    });
    window.motionCanvas.mount(nodes);
    await sleep(3000);
    let n=0; const c=(t)=>{n++; if(n<1000) requestAnimationFrame(c)}; requestAnimationFrame(c); await sleep(1000);
    await fetch(COLLECT,{method:'POST',body:JSON.stringify({label:LABEL,progress:'mounted',rafPerSec:n,visibility:document.visibilityState,hidden:document.hidden}),mode:'no-cors'});
    if (n === 0) { throw new Error('window hidden: no animation frames (screen locked or window occluded)'); }

    const pane = document.querySelector('.svelte-flow__pane') || document.querySelector('.svelte-flow');
    const cx = innerWidth / 2, cy = innerHeight / 2;

    async function sweep(kind, ms) {
      const gaps = [];
      let last = 0;
      const end = performance.now() + ms;
      let i = 0;
      await new Promise((done) => {
        const tick = (now) => {
          if (last) gaps.push(now - last);
          last = now;
          const t = i / 10;
          const init = kind === 'pan'
            ? { deltaX: Math.sin(t) * 120, deltaY: Math.cos(t * 0.7) * 120 }
            : { deltaY: Math.floor(i / 8) % 2 ? 60 : -60, ctrlKey: true };
          pane.dispatchEvent(new WheelEvent('wheel', { ...init, clientX: cx, clientY: cy, bubbles: true, cancelable: true, deltaMode: 0 }));
          i++;
          if (now < end) requestAnimationFrame(tick); else done();
        };
        requestAnimationFrame(tick);
      });
      gaps.sort((a, b) => a - b);
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const at = (p) => gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * p))];
      return { fpsAvg: Math.round(1000 / mean), fpsP5: Math.round(1000 / at(0.95)), p95ms: +at(0.95).toFixed(1), over33: gaps.filter((g) => g > 34.3).length, frames: gaps.length };
    }

    const transformBefore = document.querySelector('.svelte-flow__viewport')?.style.transform;
    const pan = await sweep('pan', 6000);
    const zoom = await sweep('zoom', 6000);
    const transformAfter = document.querySelector('.svelte-flow__viewport')?.style.transform;
    const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null;
    const result = { label: LABEL, ua: navigator.userAgent, moved: transformBefore !== transformAfter, pan, zoom, jsHeapMB: mem };
    document.title = 'BENCH_DONE';
    await fetch(COLLECT, { method: 'POST', body: JSON.stringify(result), mode: 'no-cors' });
  } catch (e) {
    await fetch(COLLECT, { method: 'POST', body: JSON.stringify({ label: LABEL, error: String(e && e.stack || e) }), mode: 'no-cors' });
  }
})();
