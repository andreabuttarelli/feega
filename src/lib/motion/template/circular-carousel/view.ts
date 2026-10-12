import { MEDIA_LIST } from '../media-list';

const CHEVRON = (points: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="${points}"/></svg>`;

const CONTROLS = `<div class="cc-controls"><button type="button" class="cc-btn" data-step="-1" aria-label="Previous">${CHEVRON('15 5 8 12 15 19')}</button><button type="button" class="cc-btn" data-step="1" aria-label="Next">${CHEVRON('9 5 16 12 9 19')}</button></div>`;

export const CAROUSEL_VIEW = String.raw`
${MEDIA_LIST}
const RING_TOP = 0.44;
const CAPTION_GAP = 0.035;
const CAPTION_RISE = 0.3;
const RESUME_AFTER = 4;
const TAP_SLOP = 6;
const VELOCITY_WINDOW = 0.1;
const LIVE_AFTER_FRAMES = 2;
const KEY_STEP = { ArrowLeft: -1, ArrowRight: 1 };

root.insertAdjacentHTML('beforeend', '<div class="cc"><div class="cc-ring"></div><p class="cc-caption"></p>${CONTROLS}</div>');

const scene = root.querySelector('.cc');
const ring = root.querySelector('.cc-ring');
const caption = root.querySelector('.cc-caption');
const controls = root.querySelector('.cc-controls');
const buttons = [...root.querySelectorAll('.cc-btn')];

let cache = { itemsKey: '', items: [], real: 0, lookKey: '' };

const listOf = (raw) => String(raw || '').split(',').map((s) => s.trim());
const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const itemHtml = (item) => {
  if (!item) {
    return '';
  }
  return item.video ? '<video muted loop playsinline preload="auto" src="' + item.src + '"></video>' : '<img decoding="sync" draggable="false" src="' + item.src + '">';
};

const buildItems = (p) => {
  const key = JSON.stringify(p.media);
  if (key === cache.itemsKey) {
    return cache.items;
  }
  const media = mediaList(p.media);
  const n = Math.max(MIN_ITEMS, media.length);
  ring.innerHTML = '';
  const items = Array.from({ length: n }, (_, i) => {
    const node = document.createElement('div');
    node.className = 'cc-item';
    node.dataset.index = String(i);
    node.innerHTML = itemHtml(media.length ? media[i % media.length] : null) + '<i class="cc-shade"></i>';
    ring.appendChild(node);
    return { node, shade: node.querySelector('.cc-shade'), video: node.querySelector('video') };
  });
  cache = { ...cache, itemsKey: key, items, real: Math.max(1, media.length) };
  return items;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.captionColor, p.placeholderColor, p.font, p.captionSize, p.captionWeight, p.tracking, p.radius, p.shadow, p.buttonColor, p.buttonStyle, p.buttons, p.drag]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--cc-bg', p.background);
  s.setProperty('--cc-ink', p.captionColor);
  s.setProperty('--cc-empty', p.placeholderColor);
  s.setProperty('--cc-btn', p.buttonColor);
  s.setProperty('--cc-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
  s.setProperty('--cc-size', String(p.captionSize));
  s.setProperty('--cc-weight', String(p.captionWeight));
  s.setProperty('--cc-tracking', p.tracking + 'em');
  s.setProperty('--cc-radius', p.radius + '%');
  s.setProperty('--cc-shadow', String(p.shadow));
  scene.classList.toggle('cc-drag', Boolean(p.drag));
  controls.style.display = p.buttons ? '' : 'none';
  buttons.forEach((b) => (b.className = 'cc-btn cc-btn-' + p.buttonStyle));
};

const render = (pos, t) => {
  const p = { ...props };
  const items = buildItems(p);
  paintLook(p);
  const { width, height } = sizeOf();
  const unit = Math.min(width, height);
  const n = items.length;
  const w = p.itemSize * p.aspect * unit;
  const h = p.itemSize * unit;

  scene.style.perspective = p.perspective * unit + 'px';
  ring.style.transform = 'rotateX(' + p.tilt + 'deg)';
  items.forEach((item, i) => {
    const slot = ringSlot(wrapOffset(i, pos, n), p);
    const s = item.node.style;
    s.width = w + 'px';
    s.height = h + 'px';
    s.transform = 'translate(-50%, -50%) translate3d(' + slot.x * unit + 'px, 0, ' + slot.z * unit + 'px) rotateY(' + slot.angle + 'rad) scale(' + slot.scale + ')';
    s.opacity = String(slot.opacity);
    s.visibility = slot.opacity > 0.002 ? 'visible' : 'hidden';
    item.shade.style.opacity = String(slot.shade);
    if (t !== null) {
      seekVideo(item.video, t);
    }
  });

  const shown = captionAt(pos, n);
  const label = listOf(p.captions)[shown.index % cache.real] || '';
  caption.textContent = p.lowercase ? label.toLowerCase() : label;
  caption.style.top = RING_TOP * height + (h * (1 + p.lift)) / 2 + CAPTION_GAP * unit + 'px';
  caption.style.opacity = String(shown.opacity);
  caption.style.transform = 'translate3d(0, ' + CAPTION_RISE * (1 - shown.opacity) + 'em, 0)';
};

const now = () => performance.now() / 1000;
const state = { from: 0, to: 0, start: now(), seconds: 0, ease: 'inout', auto: false, drag: null, press: null, lastInput: -Infinity, frames: 0 };

const posAt = (t) => (state.drag ? state.drag.pos : glide(state.from, state.to, t - state.start, state.seconds, state.ease));
const moving = (t) => t - state.start < state.seconds;
const spacing = () => props.itemSize * props.aspect * (1 + props.gap) * Math.min(sizeOf().width, sizeOf().height);

const goTo = (target, ease, auto = false) => {
  const t = now();
  Object.assign(state, { from: posAt(t), to: target, start: t, seconds: props.moveSeconds, ease, auto, drag: null });
};

const step = (dir) => goTo(stepTarget({ ...state, moving: moving(now()) }, dir), moving(now()) ? 'out' : 'inout');

const nearestCopy = (i) => state.to + Math.round(wrapOffset(i, state.to, cache.items.length));

const onDown = (e) => {
  state.lastInput = now();
  state.press = { x: e.clientX, pos: posAt(now()), target: e.target, samples: [{ t: now(), x: e.clientX }] };
};

const onMove = (e) => {
  const press = state.press;
  if (!press) {
    return;
  }
  const dx = e.clientX - press.x;
  if (!props.drag || (!state.drag && Math.abs(dx) < TAP_SLOP)) {
    return;
  }
  state.lastInput = now();
  state.drag = { pos: dragPos(press.pos, dx, spacing()) };
  press.samples = [...press.samples.filter((s) => now() - s.t < VELOCITY_WINDOW), { t: now(), x: e.clientX }];
  scene.classList.add('cc-dragging');
};

const release = (press) => {
  const first = press.samples[0];
  const last = press.samples[press.samples.length - 1];
  const dt = last.t - first.t;
  const velocity = dt > 0 ? -(last.x - first.x) / dt / spacing() : 0;
  goTo(snapTarget(state.drag.pos, velocity), 'out');
};

const tap = (target) => {
  const button = target.closest && target.closest('[data-step]');
  if (button) {
    step(Number(button.dataset.step));
    return;
  }
  const item = target.closest && target.closest('.cc-item');
  if (item) {
    goTo(nearestCopy(Number(item.dataset.index)), 'inout');
  }
};

const onUp = () => {
  const press = state.press;
  state.press = null;
  if (!press) {
    return;
  }
  state.lastInput = now();
  scene.classList.remove('cc-dragging');
  if (state.drag) {
    release(press);
    return;
  }
  tap(press.target);
};

const onKey = (e) => {
  const dir = KEY_STEP[e.key];
  if (!dir) {
    return;
  }
  state.lastInput = now();
  step(dir);
};

const autoplay = (t) => {
  const hold = Math.max(0.2, props.interval - props.moveSeconds);
  const idleSince = Math.max(state.lastInput + RESUME_AFTER, state.start + state.seconds);
  if (props.autoplay && !state.press && t - idleSince >= hold) {
    goTo(state.to + (SIGN[props.direction] ?? 1), 'inout', true);
  }
};

const playVideos = () => cache.items.forEach((item) => item.video && item.video.paused && item.video.play().catch(() => {}));

const loop = () => {
  const t = now();
  state.frames += 1;
  if (state.frames >= LIVE_AFTER_FRAMES) {
    autoplay(t);
    playVideos();
  }
  render(posAt(t), null);
  requestAnimationFrame(loop);
};

scene.addEventListener('pointerdown', onDown);
document.addEventListener('pointermove', onMove);
document.addEventListener('pointerup', onUp);
document.addEventListener('pointercancel', onUp);
document.addEventListener('keydown', onKey);
onDestroy(() => {
  document.removeEventListener('pointermove', onMove);
  document.removeEventListener('pointerup', onUp);
  document.removeEventListener('pointercancel', onUp);
  document.removeEventListener('keydown', onKey);
});

render(0, 0);
requestAnimationFrame(loop);

return { still: (t) => render(sequencePos(t, props), t) };
`;
