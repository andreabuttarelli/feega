import { MEDIA_LIST } from '../media-list';

export const BADGE_VIEW = String.raw`
${MEDIA_LIST}
const GLYPH = '<svg class="ib-glyph" viewBox="0 0 24 24"><path d="M3 3h5.5L16 14.5V3h5v18h-5.5L8 9.5V21H3z"/></svg>';
const PLANET_TOP = 0.78;

root.insertAdjacentHTML('beforeend', '<div class="ib"><div class="ib-planet"></div><div class="ib-row"><span class="ib-words ib-intro"></span><span class="ib-badge"><span class="ib-logo"></span><span class="ib-mark"></span><span class="ib-suffix"></span><span class="ib-shine"></span></span><span class="ib-words ib-name"></span></div></div>');

const scene = root.querySelector('.ib');
const planet = root.querySelector('.ib-planet');
const intro = root.querySelector('.ib-intro');
const name = root.querySelector('.ib-name');
const badge = root.querySelector('.ib-badge');
const logo = root.querySelector('.ib-logo');
const shine = root.querySelector('.ib-shine');

let cache = { lookKey: '', textKey: '', intro: [], name: [], logoKey: '' };

const fontOf = (font) => (String(font).includes(',') ? font : '"' + font + '", "Helvetica Neue", Helvetica, Arial, sans-serif');

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.textColor, p.accent, p.glow, p.font, p.fontSize, p.fontWeight, p.tracking]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--ib-bg', p.background);
  s.setProperty('--ib-ink', p.textColor);
  s.setProperty('--ib-accent', p.accent);
  s.setProperty('--ib-glow', p.glow);
  s.setProperty('--ib-font', fontOf(p.font));
  s.setProperty('--ib-size', String(p.fontSize));
  s.setProperty('--ib-weight', String(p.fontWeight));
  s.setProperty('--ib-tracking', p.tracking + 'em');
};

const wordsInto = (host, raw) => {
  const words = String(raw || '').trim().split(/\s+/).filter(Boolean);
  host.innerHTML = '';
  return words.map((word, i) => {
    const node = document.createElement('span');
    node.className = 'ib-word';
    node.textContent = word + (i < words.length - 1 ? ' ' : '');
    host.appendChild(node);
    return node;
  });
};

const paintText = (p) => {
  const key = JSON.stringify([p.intro, p.product, p.brand, p.brandSuffix]);
  if (key === cache.textKey) {
    return;
  }
  root.querySelector('.ib-mark').textContent = p.brand;
  root.querySelector('.ib-suffix').textContent = p.brandSuffix;
  cache = { ...cache, textKey: key, intro: wordsInto(intro, p.intro), name: wordsInto(name, p.product) };
};

const paintLogo = (p) => {
  const key = JSON.stringify(p.logo);
  if (key === cache.logoKey) {
    return;
  }
  cache = { ...cache, logoKey: key };
  const picked = mediaList(p.logo)[0];
  logo.innerHTML = picked && !picked.video ? '<img class="ib-glyph-image" decoding="sync" src="' + picked.src + '">' : GLYPH;
};

const paintWords = (nodes, frames) => frames.forEach((w, i) => {
  nodes[i].style.opacity = String(w.opacity);
  nodes[i].style.transform = 'translate3d(0, ' + w.y + 'em, 0)';
});

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  paintLook(p);
  paintText(p);
  paintLogo(p);
  const height = scene.clientHeight || 1080;
  const f = badgeFrame(p, t, duration, cache.intro.length, cache.name.length);

  planet.style.transform = 'translate3d(0, ' + (PLANET_TOP + p.arcRise - f.arc.lift) * height + 'px, 0)';
  planet.style.opacity = String(f.arc.opacity);
  paintWords(cache.intro, f.intro);
  paintWords(cache.name, f.name);
  badge.style.opacity = String(f.badge.opacity);
  badge.style.transform = 'scale(' + f.badge.scale + ')';
  shine.style.opacity = String(f.badge.shineOpacity);
  shine.style.transform = 'translate3d(' + (f.badge.shine * 240 - 120) + '%, 0, 0)';
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
