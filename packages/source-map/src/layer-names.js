const TEXT_NODE = 3;
const MAX_LABEL_LENGTH = 32;
const ELLIPSIS = '…';

const Label = { Text: 'text', Aria: 'aria-label', Alt: 'alt' };
const Kind = { Leaf: 'leaf', Container: 'container' };

const leaf = (name, ...labels) => ({ name, kind: Kind.Leaf, labels });
const container = (name) => ({ name, kind: Kind.Container, labels: [] });

const HEADINGS = Object.fromEntries([1, 2, 3, 4, 5, 6].map((level) => [`h${level}`, leaf(`Heading ${level}`, Label.Text)]));

const TAG_RULES = {
  ...HEADINGS,
  p: leaf('Paragraph', Label.Text),
  span: leaf('Text', Label.Text),
  label: leaf('Label', Label.Text),
  li: leaf('List item', Label.Text),
  a: leaf('Link', Label.Text, Label.Aria),
  button: leaf('Button', Label.Text, Label.Aria),
  img: leaf('Image', Label.Alt, Label.Aria),
  svg: leaf('Vector', Label.Aria),
  video: leaf('Video', Label.Aria),
  input: leaf('Input', Label.Aria),
  textarea: leaf('Text area', Label.Aria),
  select: leaf('Select', Label.Aria),
  form: container('Form'),
  ul: container('List'),
  ol: container('List'),
  nav: container('Nav'),
  header: container('Header'),
  footer: container('Footer'),
  section: container('Section'),
  main: container('Main'),
  article: container('Article'),
  aside: container('Aside'),
  div: container('Frame')
};

const FRAME_TAG = 'div';

const FRAME_LAYOUTS = [
  { test: (style) => /grid$/.test(style.display), name: 'Grid' },
  { test: (style) => /flex$/.test(style.display) && (style.flexDirection || 'row').startsWith('column'), name: 'Stack' },
  { test: (style) => /flex$/.test(style.display), name: 'Row' }
];

const UTILITY_WORDS = new Set([
  'flex', 'grid', 'block', 'inline', 'hidden', 'table', 'contents', 'container', 'relative', 'absolute', 'fixed', 'sticky', 'static',
  'visible', 'invisible', 'truncate', 'uppercase', 'lowercase', 'capitalize', 'underline', 'italic', 'antialiased', 'isolate',
  'transition', 'transform', 'border', 'rounded', 'shadow', 'ring', 'outline', 'grow', 'shrink', 'float', 'clear', 'filter', 'blur', 'resize'
]);

const UTILITY_PREFIXES = new Set([
  'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe', 'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me', 'w', 'h', 'size', 'min', 'max',
  'gap', 'space', 'text', 'font', 'bg', 'from', 'via', 'to', 'border', 'rounded', 'shadow', 'ring', 'outline', 'opacity', 'z', 'top',
  'right', 'bottom', 'left', 'inset', 'start', 'end', 'items', 'justify', 'content', 'self', 'place', 'order', 'col', 'row', 'grow',
  'shrink', 'basis', 'overflow', 'object', 'cursor', 'select', 'pointer', 'transition', 'duration', 'ease', 'delay', 'animate',
  'transform', 'scale', 'rotate', 'translate', 'skew', 'origin', 'fill', 'stroke', 'sr', 'underline', 'line', 'list', 'leading',
  'tracking', 'whitespace', 'break', 'float', 'aspect', 'columns', 'divide', 'backdrop', 'blur', 'brightness', 'contrast', 'grayscale',
  'accent', 'caret', 'decoration', 'indent', 'align', 'flex', 'grid', 'inline', 'block', 'table', 'dark', 'group', 'peer', 'hover',
  'focus', 'sm', 'md', 'lg', 'xl', 'tw', 'css', 'sc', 'jsx', 'svelte', 'astro', 'chakra'
]);

const NOT_NAMEABLE = /[:[\]/!@.%()#,=]|\d/;
const GENERATED_PREFIX = /^[-_]/;
const WORD_BOUNDARY = /[-_\s]+|(?<=[a-z])(?=[A-Z])/;

const isUtilityClass = (name) => {
  if (UTILITY_WORDS.has(name) || NOT_NAMEABLE.test(name) || GENERATED_PREFIX.test(name)) {
    return true;
  }
  return UTILITY_PREFIXES.has(name.split('-')[0]);
};

const isGeneratedId = (id) => NOT_NAMEABLE.test(id) || GENERATED_PREFIX.test(id);

const humanize = (value) => {
  const text = value.split(WORD_BOUNDARY).filter(Boolean).join(' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const truncated = (text) => (text.length > MAX_LABEL_LENGTH ? `${text.slice(0, MAX_LABEL_LENGTH).trimEnd()}${ELLIPSIS}` : text);

const ownText = (element) =>
  [...element.childNodes]
    .filter((node) => node.nodeType === TEXT_NODE)
    .map((node) => node.textContent)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const LABEL_SOURCES = {
  [Label.Text]: ownText,
  [Label.Aria]: (element) => element.getAttribute('aria-label')?.trim() ?? '',
  [Label.Alt]: (element) => element.getAttribute('alt')?.trim() ?? ''
};

const labelOf = (element, labels) => {
  for (const label of labels) {
    const text = LABEL_SOURCES[label](element);
    if (text) {
      return truncated(text);
    }
  }
  return '';
};

const authoredName = (element) => {
  const id = element.id;
  if (id && !isGeneratedId(id)) {
    return humanize(id);
  }
  const semantic = [...(element.classList ?? [])].find((name) => !isUtilityClass(name));
  return semantic ? humanize(semantic) : '';
};

const frameName = (element) => {
  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  return FRAME_LAYOUTS.find((layout) => layout.test(style))?.name ?? TAG_RULES[FRAME_TAG].name;
};

const capitalised = (tag) => tag.charAt(0).toUpperCase() + tag.slice(1);

export function layerName(element) {
  const tag = element.tagName.toLowerCase();
  const rule = TAG_RULES[tag];
  if (!rule) {
    return authoredName(element) || capitalised(tag);
  }
  const label = labelOf(element, rule.labels);
  if (label) {
    return label;
  }
  if (rule.kind === Kind.Container) {
    return authoredName(element) || (tag === FRAME_TAG ? frameName(element) : rule.name);
  }
  return rule.name;
}
