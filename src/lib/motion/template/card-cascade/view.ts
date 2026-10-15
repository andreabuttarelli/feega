import { MEDIA_LIST } from '../media-list';
import { MEDIA_SLOT } from '../soft-settle';

export const CC_VIEW = String.raw`
${MEDIA_LIST}
${MEDIA_SLOT}
const CARD_ASPECT = 1.02;
const LIST_LINE = 0.135;

root.insertAdjacentHTML('beforeend', '<div class="cc"><div class="cc-stack"></div></div>');

const scene = root.querySelector('.cc');
const stack = root.querySelector('.cc-stack');

let cache = { layoutKey: '', layout: null, buildKey: '', nodes: [], lists: [], lookKey: '' };

const sizeOf = () => ({ width: scene.clientWidth || 1080, height: scene.clientHeight || 1920 });

const layoutFor = (p) => {
  const key = JSON.stringify([p.count]);
  if (key !== cache.layoutKey) {
    cache = { ...cache, layoutKey: key, layout: cascadeLayout(p), buildKey: '' };
  }
  return cache.layout;
};

const listFace = (node, p) => {
  const track = make(node, 'div', 'cc-track');
  const words = linesOf(p.words);
  [0, 1].forEach(() => words.forEach((w) => (make(track, 'span', 'cc-word').textContent = w)));
  return track;
};

const FACES = {
  photo: (node, card, items) => ({ video: mountMedia(node, items.length ? items[card.media % items.length] : null) }),
  type: (node, card, items, p) => {
    linesOf(p.typeLines).forEach((line) => (make(node, 'span', 'cc-line').textContent = line));
    return {};
  },
  list: (node, card, items, p) => ({ track: listFace(node, p) }),
  letter: (node, card, items, p) => {
    make(node, 'span', 'cc-glyph').textContent = p.letter;
    return {};
  },
  colour: (node, card, items, p) => {
    make(node, 'span', 'cc-tag').textContent = p.tag;
    return {};
  }
};

const build = (p, layout, width, height) => {
  const key = JSON.stringify([p.media, p.typeLines, p.words, p.letter, p.tag, p.cardSize, layout.n, width, height]);
  if (key === cache.buildKey) {
    return cache.nodes;
  }
  const items = mediaList(p.media);
  const w = Math.min(width, height) * p.cardSize;
  const h = w * CARD_ASPECT;
  stack.innerHTML = '';
  stack.style.left = width / 2 + 'px';
  stack.style.top = height / 2 + 'px';
  const nodes = layout.cards.map((card) => {
    const node = make(stack, 'div', 'cc-card cc-' + card.kind);
    node.style.width = w + 'px';
    node.style.height = h + 'px';
    node.style.left = -w / 2 + 'px';
    node.style.top = -h / 2 + 'px';
    node.style.fontSize = w + 'px';
    return { node, w, ...FACES[card.kind](node, card, items, p) };
  });
  const lines = linesOf(p.words).length;
  const lists = nodes.filter((n) => n.track).map((n) => ({ track: n.track, height: lines * LIST_LINE * w }));
  cache = { ...cache, buildKey: key, nodes, lists };
  return nodes;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.typeColor, p.listColor, p.letterColor, p.tagColor, p.ink, p.placeholderColor, p.radius, p.font, p.weight, p.tracking]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--cc-bg', p.background);
  s.setProperty('--cc-type', p.typeColor);
  s.setProperty('--cc-list', p.listColor);
  s.setProperty('--cc-letter', p.letterColor);
  s.setProperty('--cc-tag', p.tagColor);
  s.setProperty('--cc-ink', p.ink);
  s.setProperty('--cc-empty', p.placeholderColor);
  s.setProperty('--cc-radius', p.radius + '%');
  s.setProperty('--cc-font', fontOf(p.font));
  s.setProperty('--cc-weight', String(p.weight));
  s.setProperty('--cc-tracking', p.tracking + 'em');
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  paintLook(p);
  const layout = layoutFor(p);
  const nodes = build(p, layout, width, height);
  const f = cascadeFrame(layout, p, t, duration);

  f.cards.forEach((c, i) => {
    const node = nodes[i];
    const s = node.node.style;
    s.opacity = String(c.opacity);
    s.visibility = c.opacity > 0.001 ? 'visible' : 'hidden';
    s.zIndex = String(c.z);
    s.transform = 'translate3d(' + c.x * node.w + 'px, ' + c.y * node.w + 'px, 0) rotate(' + c.turn + 'deg) scale(' + c.scale + ')';
    seekVideo(node.video, t);
  });
  cache.lists.forEach((list) => {
    list.track.style.transform = 'translate3d(0, ' + -f.scroll * list.height + 'px, 0)';
  });
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
