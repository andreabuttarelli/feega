import { MEDIA_LIST } from '../media-list';
import { PHONE_DEVICE } from '../phone-device';

export const CHAT_VIEW = String.raw`
${MEDIA_LIST}
${PHONE_DEVICE}
const TINTS = ['#cfe3c6', '#f5d8b6', '#d8d3f1', '#f2cfd5', '#cbe2ee', '#ece2b4'];
const CLUSTER = [[50, 52, 9.5], [27, 40, 5.6], [56, 16, 5], [76, 76, 5.4]];
const UI_SCALE = 0.85;
const SCREEN_INSET = 3.6;
const LIST_TOP = 40.5;
const TYPING_W = 14.5;
const TYPING_H = 9.2;
const CAMERA_Y = 0.62;
const FRAME_MARGIN = 0.05;

const ICON_BACK = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_VIDEO = '<svg viewBox="0 0 28 24"><rect x="2" y="5" width="16" height="14" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18 10l7-4v12l-7-4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const ICON_WIFI = '<svg viewBox="0 0 24 18"><path d="M2 6.5a15 15 0 0 1 20 0M5.5 10a10 10 0 0 1 13 0M9 13.5a5 5 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="16" r="1.6" fill="currentColor"/></svg>';
const ICON_SIGNAL = '<svg viewBox="0 0 24 18"><rect x="1" y="11" width="4" height="6" fill="currentColor"/><rect x="7" y="8" width="4" height="9" fill="currentColor"/><rect x="13" y="4.5" width="4" height="12.5" fill="currentColor"/><rect x="19" y="1" width="4" height="16" fill="currentColor"/></svg>';
const ICON_BATTERY = '<svg viewBox="0 0 30 16"><rect x="1" y="1" width="25" height="14" fill="none" stroke="currentColor" stroke-width="1.6" opacity="0.45"/><rect x="3.5" y="3.5" width="20" height="9" fill="currentColor"/><rect x="27.5" y="5" width="2" height="6" fill="currentColor" opacity="0.45"/></svg>';

const UI = '<div class="pc-ui"><div class="pc-status"><span class="pc-clock"></span><span class="pc-icons">' + ICON_SIGNAL + ICON_WIFI + ICON_BATTERY + '</span></div><div class="pc-round pc-back">' + ICON_BACK + '</div><div class="pc-round pc-video">' + ICON_VIDEO + '</div><div class="pc-cluster"></div><div class="pc-title"><span class="pc-pill"><span class="pc-name"></span><span class="pc-more">›</span></span></div><div class="pc-list"><div class="pc-feed"></div></div><div class="ps-glare"></div></div>';

root.insertAdjacentHTML('beforeend', '<div class="pc"><div class="pc-cam"><div class="pc-phone">' + deviceHtml(UI) + '</div></div></div>');

const scene = root.querySelector('.pc');
const cam = root.querySelector('.pc-cam');
const phone = root.querySelector('.pc-phone');
const ui = root.querySelector('.pc-ui');
const feed = root.querySelector('.pc-feed');
const cluster = root.querySelector('.pc-cluster');

let cache = { chatKey: '', slots: [], lookKey: '', measureKey: '', layout: null, overflow: [] };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });
const fontsReady = () => (document.fonts ? document.fonts.status : 'loaded');
const fontOf = (p) => (String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const people = (messages) => [...new Set(messages.map((m) => m.name))];

const avatarHtml = (name, index, pictures) => {
  const picture = pictures[index];
  if (picture) {
    return '<i class="pc-face"><img decoding="sync" src="' + picture.src + '"></i>';
  }
  const tint = TINTS[index % TINTS.length];
  return '<i class="pc-face" style="background:' + tint + '"><b>' + esc((name || '·').slice(0, 1).toUpperCase()) + '</b></i>';
};

const slotHtml = (m, face) => '<div class="pc-slot">' + (m.name ? '<div class="pc-who">' + esc(m.name) + '</div>' : '') + '<div class="pc-row"><span class="pc-avatar">' + face + '</span><div class="pc-shell"><div class="pc-text">' + esc(m.text) + '</div><div class="pc-dots"><i></i><i></i><i></i></div></div></div></div>';

const buildChat = (p) => {
  const key = JSON.stringify([p.messages, p.avatars, p.title, p.clock]);
  if (key === cache.chatKey) {
    return cache.slots;
  }
  const messages = parseMessages(p.messages);
  const names = people(messages);
  const pictures = mediaList(p.avatars);
  const faces = names.map((name, i) => avatarHtml(name, i, pictures));
  feed.innerHTML = messages.map((m) => slotHtml(m, faces[names.indexOf(m.name)])).join('');
  cluster.innerHTML = CLUSTER.slice(0, Math.max(1, names.length)).map(([x, y, size], i) => '<span style="left:' + x + '%;top:' + y + '%;font-size:' + size + 'em">' + (faces[i] || faces[0] || '') + '</span>').join('');
  ui.querySelector('.pc-name').textContent = p.title;
  ui.querySelector('.pc-clock').textContent = p.clock;
  const slots = [...feed.children].map((node) => ({ node, shell: node.querySelector('.pc-shell'), text: node.querySelector('.pc-text'), dots: [...node.querySelectorAll('.pc-dots i')], who: node.querySelector('.pc-who') }));
  cache = { ...cache, chatKey: key, slots, measureKey: '' };
  return slots;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.screen, p.bubble, p.ink, p.font, p.finish, p.shadow]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key, measureKey: '' };
  const finish = FINISHES[p.finish] || FINISHES.natural;
  const s = scene.style;
  s.setProperty('--pc-bg', p.background);
  s.setProperty('--pc-screen', p.screen);
  s.setProperty('--pc-bubble', p.bubble);
  s.setProperty('--pc-ink', p.ink);
  s.setProperty('--pc-font', fontOf(p));
  s.setProperty('--ps-rim', finish[0]);
  s.setProperty('--ps-rim-dark', finish[1]);
  s.setProperty('--ps-shadow', String(p.shadow));
};

const visibleRows = (layout, height, em, uiEm, push) => {
  const origin = height * CAMERA_Y;
  const edge = origin + (height * (1 - FRAME_MARGIN) - origin) / (1 + push);
  const listTop = layout.top + SCREEN_INSET * em + LIST_TOP * uiEm;
  const screenBottom = layout.top + layout.phoneH - SCREEN_INSET * em;
  return (Math.min(edge, screenBottom) - listTop) / uiEm;
};

const measure = (p, slots) => {
  const { width, height } = sizeOf();
  const key = JSON.stringify([width, height, cache.chatKey, cache.lookKey, p.phoneSize, p.phoneTop, p.push, fontsReady()]);
  if (key === cache.measureKey) {
    return cache.layout;
  }
  const layout = chatLayout(p, { frameW: width, frameH: height });
  const em = layout.phoneW / 100;
  const uiEm = em * UI_SCALE;
  phone.style.cssText = 'left:' + (width - layout.phoneW) / 2 + 'px;top:' + layout.top + 'px';
  scene.style.setProperty('--ps-w', layout.phoneW + 'px');
  scene.style.setProperty('--ps-h', layout.phoneH + 'px');
  scene.style.setProperty('--pc-em', uiEm + 'px');
  const sizes = slots.map((s) => ({ w: s.text.offsetWidth / uiEm, h: s.text.offsetHeight / uiEm, label: s.who ? s.who.offsetHeight / uiEm : 0 }));
  const gap = parseFloat(getComputedStyle(feed).rowGap || '0') / uiEm || 0;
  const room = visibleRows(layout, height, em, uiEm, p.push);
  let bottom = 0;
  const overflow = sizes.map((size) => {
    const before = Math.max(0, bottom - room);
    bottom += size.label + size.h + gap;
    return Math.max(0, bottom - room) - before;
  });
  cache = { ...cache, measureKey: key, layout: { ...layout, sizes }, overflow };
  return cache.layout;
};

const lerp = (a, b, x) => a + (b - a) * x;

const drawSlot = (slot, size, b) => {
  if (b.slot <= 0) {
    slot.node.style.display = 'none';
    return;
  }
  slot.node.style.display = '';
  slot.node.style.opacity = String(b.slot);
  slot.node.style.transform = 'translateY(' + (1 - b.slot) * 3 + 'em)';
  slot.shell.style.width = lerp(TYPING_W, size.w, b.morph) + 'em';
  slot.shell.style.height = lerp(TYPING_H, size.h, b.morph) + 'em';
  slot.text.style.opacity = String(b.text);
  slot.text.style.transform = 'translateY(' + (1 - b.text) * 0.6 + 'em)';
  slot.dots.forEach((dot, k) => {
    dot.style.opacity = String(b.dots[k]);
  });
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const slots = buildChat(p);
  paintLook(p);
  const layout = measure(p, slots);
  const f = chatFrame(p, t, duration, cache.overflow);

  cam.style.transform = 'scale(' + f.camera + ')';
  feed.style.opacity = String(f.fade);
  feed.style.transform = 'translateY(' + -f.scroll + 'em)';
  slots.forEach((slot, i) => drawSlot(slot, layout.sizes[i], f.bubbles[i]));
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
