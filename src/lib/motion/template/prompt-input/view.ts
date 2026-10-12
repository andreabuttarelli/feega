export const PROMPT_VIEW = String.raw`
const THEMES = {
  light: { field: '#ffffff', ink: '#0a0a0a', muted: 'rgba(10, 10, 10, 0.42)', line: 'rgba(10, 10, 10, 0.09)', chip: 'rgba(10, 10, 10, 0.05)', idle: 'rgba(10, 10, 10, 0.1)', highlight: 'rgba(255, 255, 255, 0.9)', depth: 1 },
  dark: { field: '#141414', ink: '#f5f5f5', muted: 'rgba(245, 245, 245, 0.4)', line: 'rgba(255, 255, 255, 0.09)', chip: 'rgba(255, 255, 255, 0.07)', idle: 'rgba(255, 255, 255, 0.12)', highlight: 'rgba(255, 255, 255, 0.07)', depth: 2.2 }
};

const SHAPES = { sharp: '0px', pill: '1.75em' };

const ICONS = {
  'arrow-up': '<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/>',
  'arrow-right': '<path d="M5 12h14M12.5 5.5 19 12l-6.5 6.5"/>',
  send: '<path d="M4.5 12 20 4.5 13.5 20l-2.5-6.5L4.5 12Z"/>',
  sparkle: '<path d="M12 3.5c.6 4.4 2.4 6.3 6.5 7-4.1.7-5.9 2.6-6.5 7-.6-4.4-2.4-6.3-6.5-7 4.1-.7 5.9-2.6 6.5-7Z"/>'
};

const svg = (inner, cls) => '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
const PLUS = svg('<path d="M12 6v12M6 12h12"/>', 'pi-glyph');
const FILE = svg('<path d="M14 3.5H7.5a1.5 1.5 0 0 0-1.5 1.5v14a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V7.5l-4-4Z"/><path d="M14 3.5v4h4"/>', 'pi-chip-icon');
const STOP = '<svg class="pi-stop" viewBox="0 0 24 24"><rect x="7.5" y="7.5" width="9" height="9" fill="currentColor"/></svg>';
const POINTER = '<svg class="pi-pointer" viewBox="0 0 24 24"><path d="M5 3.2v15.9l4.3-4.1 2.7 6.2 2.9-1.3-2.7-6.1h6L5 3.2Z" fill="#0a0a0a" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round"/></svg>';

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const chipList = (raw) => String(raw || '').split(',').map((s) => s.trim()).filter(Boolean);
const isFile = (chip) => /\.[a-z0-9]{2,4}$/i.test(chip);
const chipHtml = (chip) => '<span class="pi-chip">' + (isFile(chip) ? FILE : '<i class="pi-dot"></i>') + '<span>' + escapeHtml(chip) + '</span></span>';
const colourOr = (value, fallback) => (!value || value === 'transparent' ? fallback : value);

root.insertAdjacentHTML('beforeend',
  '<div class="pi">' +
  '<div class="pi-stage">' +
  '<div class="pi-box">' +
  '<div class="pi-text"><span class="pi-ghost"></span><span class="pi-line"><span class="pi-typed"></span><i class="pi-caret"></i></span><span class="pi-placeholder"></span><span class="pi-thinking"></span></div>' +
  '<div class="pi-bar"><div class="pi-tools"><span class="pi-plus">' + PLUS + '</span><span class="pi-chips"></span></div>' +
  '<div class="pi-send"><span class="pi-send-face"><span class="pi-label"></span><span class="pi-icons"><span class="pi-icon"></span>' + STOP + '</span></span>' +
  '<div class="pi-cursor">' + POINTER + '</div></div></div>' +
  '</div>' +
  '</div>' +
  '</div>');

const el = (selector) => root.querySelector(selector);
const nodes = {
  scene: el('.pi'), stage: el('.pi-stage'), box: el('.pi-box'), ghost: el('.pi-ghost'), line: el('.pi-line'), typed: el('.pi-typed'), caret: el('.pi-caret'),
  placeholder: el('.pi-placeholder'), thinking: el('.pi-thinking'), chips: el('.pi-chips'), plus: el('.pi-plus'), send: el('.pi-send'), face: el('.pi-send-face'),
  label: el('.pi-label'), icon: el('.pi-icon'), stop: el('.pi-stop'), cursor: el('.pi-cursor')
};

const TIMING = ['text', 'startDelay', 'speed', 'typo', 'typoAt', 'repeat', 'submit'];
let cache = { key: '', plan: null, look: '' };

const planFor = (p) => {
  const key = JSON.stringify(TIMING.map((name) => p[name]));
  if (key !== cache.key) {
    cache = { ...cache, key, plan: promptPlan(p, duration) };
  }
  return cache.plan;
};

const paintLook = (p) => {
  const theme = THEMES[p.theme] || THEMES.light;
  const look = JSON.stringify([p.theme, p.accent, p.background, p.fieldColor, p.textColor, p.font, p.fontSize, p.fontWeight, p.shape, p.radius, p.width, p.shadow, p.text, p.placeholder, p.chips, p.buttonLabel, p.buttonIcon, p.thinkingLabel]);
  if (look === cache.look) {
    return;
  }
  cache = { ...cache, look };
  const s = nodes.scene.style;
  s.setProperty('--pi-accent', p.accent);
  s.setProperty('--pi-bg', p.background);
  s.setProperty('--pi-field', colourOr(p.fieldColor, theme.field));
  s.setProperty('--pi-ink', colourOr(p.textColor, theme.ink));
  s.setProperty('--pi-muted', theme.muted);
  s.setProperty('--pi-line', theme.line);
  s.setProperty('--pi-chip', theme.chip);
  s.setProperty('--pi-idle', theme.idle);
  s.setProperty('--pi-highlight', theme.highlight);
  s.setProperty('--pi-depth', String(theme.depth * p.shadow));
  s.setProperty('--pi-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
  s.setProperty('--pi-size', String(p.fontSize));
  s.setProperty('--pi-weight', String(p.fontWeight));
  s.setProperty('--pi-width', String(p.width));
  s.setProperty('--pi-radius', p.shape === 'rounded' ? p.radius + 'em' : SHAPES[p.shape] || '0px');
  nodes.ghost.textContent = p.text || ' ';
  nodes.placeholder.textContent = p.placeholder;
  nodes.thinking.textContent = p.thinkingLabel;
  nodes.chips.innerHTML = chipList(p.chips).map(chipHtml).join('');
  nodes.label.textContent = p.buttonLabel;
  nodes.send.classList.toggle('pi-labelled', Boolean(p.buttonLabel));
  nodes.icon.innerHTML = svg(ICONS[p.buttonIcon] || ICONS['arrow-up'], 'pi-arrow');
};

const paintFrame = (p, f) => {
  nodes.typed.textContent = f.shown;
  nodes.line.style.opacity = String(f.textOpacity);
  nodes.line.style.transform = 'translateY(' + (-0.7 * f.textLift) + 'em)';
  nodes.line.style.filter = f.textLift > 0.001 ? 'blur(' + (0.08 * f.textLift) + 'em)' : 'none';
  nodes.caret.style.opacity = String(f.caret);
  nodes.placeholder.style.opacity = String(f.placeholder);
  nodes.thinking.style.opacity = String(f.thinking);
  nodes.thinking.style.backgroundPosition = (-200 * f.shimmer) + '% 0';
  nodes.box.style.setProperty('--pi-focus', String(f.focus));
  nodes.stage.style.transform = 'scale(' + (1 + p.zoom * f.zoom) + ')';
  nodes.send.style.setProperty('--pi-armed', String(f.armed));
  nodes.face.style.transform = 'scale(' + (1 - 0.09 * f.press) + ')';
  nodes.icon.style.opacity = String(1 - f.stop);
  nodes.icon.style.transform = 'scale(' + (1 - 0.4 * f.stop) + ')';
  nodes.stop.style.opacity = String(f.stop);
  nodes.stop.style.transform = 'scale(' + (0.6 + 0.4 * f.stop) + ')';
  const shown = p.cursor ? f.cursor : 0;
  nodes.cursor.style.opacity = String(shown);
  nodes.cursor.style.visibility = shown > 0.001 ? 'visible' : 'hidden';
  nodes.cursor.style.setProperty('--pi-cx', String(f.cursorX));
  nodes.cursor.style.setProperty('--pi-cy', String(f.cursorY));
  nodes.cursor.style.setProperty('--pi-cpress', String(Math.max(0, f.press)));
};

const draw = () => {
  const p = { ...props };
  paintLook(p);
  paintFrame(p, promptFrame(planFor(p), tl.time()));
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
