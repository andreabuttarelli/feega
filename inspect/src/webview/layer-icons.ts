export enum LayerIcon {
  FlexRow = 'flex-row',
  FlexColumn = 'flex-column',
  Grid = 'grid',
  Block = 'block',
  H1 = 'h1',
  H2 = 'h2',
  H3 = 'h3',
  H4 = 'h4',
  H5 = 'h5',
  H6 = 'h6',
  Text = 'text',
  Inline = 'inline',
  Link = 'link',
  Button = 'button',
  Image = 'image',
  Vector = 'vector',
  Video = 'video',
  Input = 'input',
  Textarea = 'textarea',
  Select = 'select',
  Form = 'form',
  List = 'list',
  Nav = 'nav',
  Header = 'header',
  Footer = 'footer',
  Component = 'component',
  Instance = 'instance',
  Repeat = 'repeat',
  Head = 'head',
  Meta = 'meta',
  Title = 'title',
  Floating = 'floating'
}

export enum Floating {
  Absolute = 'absolute',
  Fixed = 'fixed',
  Sticky = 'sticky'
}

const FLOATS_OUT_OF_FLOW = new Set<string>([Floating.Absolute, Floating.Fixed]);

export const floatingOf = (position: string): Floating | null => (Object.values(Floating) as string[]).includes(position) ? (position as Floating) : null;

export type IconNode = { tag: string; display: string; direction: string; component: boolean; count: number; position: string };

const FLEX_BARS = '<rect x="2.25" y="2.75" width="4.5" height="10.5" rx="2"/><rect x="9.25" y="2.75" width="4.5" height="10.5" rx="2"/>';
const H_BARS = '<line x1="2.25" y1="3" x2="2.25" y2="13"/><line x1="7.25" y1="3" x2="7.25" y2="13"/><line x1="2.25" y1="8" x2="7.25" y2="8"/>';
const heading = (digit: string) => `${H_BARS}<path d="${digit}"/>`;

export const ICON_SVG: Record<LayerIcon, string> = {
  [LayerIcon.FlexRow]: FLEX_BARS,
  [LayerIcon.FlexColumn]: `<g transform="rotate(90 8 8)">${FLEX_BARS}</g>`,
  [LayerIcon.Grid]: '<g><rect x="2.25" y="2.25" width="4.25" height="4.25" rx="1"/><rect x="9.5" y="2.25" width="4.25" height="4.25" rx="1"/><rect x="2.25" y="9.5" width="4.25" height="4.25" rx="1"/><rect x="9.5" y="9.5" width="4.25" height="4.25" rx="1"/></g>',
  [LayerIcon.Block]: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/>',
  [LayerIcon.H1]: heading('M10.5 9.75 L12.5 8.25 L12.5 13'),
  [LayerIcon.H2]: heading('M10.25 9.5 Q10.5 8.25 11.75 8.25 Q13 8.25 13 9.4 Q13 10.3 10.25 13 L13 13'),
  [LayerIcon.H3]: heading('M10.25 8.25 L13 8.25 L11.5 10.25 Q13.25 10.25 13.25 11.6 Q13.25 13 11.75 13 Q10.6 13 10.25 12.3'),
  [LayerIcon.H4]: heading('M12.25 13 L12.25 8.25 L10 11.5 L13.5 11.5'),
  [LayerIcon.H5]: heading('M13 8.25 L10.75 8.25 L10.5 10.4 Q11 10 11.75 10 Q13.25 10 13.25 11.5 Q13.25 13 11.75 13 Q10.75 13 10.25 12.4'),
  [LayerIcon.H6]: heading('M12.75 8.25 Q10.25 8.6 10.25 11.3 Q10.25 13 11.75 13 Q13.25 13 13.25 11.6 Q13.25 10.2 11.75 10.2 Q10.6 10.2 10.25 11'),
  [LayerIcon.Text]: '<g><path d="M8.25 2.25 H6.5 A2.125 2.125 0 0 0 6.5 6.5 H8.25"/><line x1="8.25" y1="2.25" x2="8.25" y2="9.25"/><line x1="10.75" y1="2.25" x2="10.75" y2="9.25"/><line x1="8.25" y1="2.25" x2="12.25" y2="2.25"/><line x1="2.25" y1="12.75" x2="13.75" y2="12.75"/><path d="M12.689 11.689 L13.75 12.75 L12.689 13.811"/></g>',
  [LayerIcon.Inline]: '<g><path d="M8.25 2.25 H6.5 A2.125 2.125 0 0 0 6.5 6.5 H8.25"/><line x1="8.25" y1="2.25" x2="8.25" y2="9.25"/><line x1="10.75" y1="2.25" x2="10.75" y2="9.25"/><line x1="8.25" y1="2.25" x2="12.25" y2="2.25"/><line x1="2.25" y1="12.75" x2="13.75" y2="12.75"/><path d="M12.689 11.689 L13.75 12.75 L12.689 13.811"/></g>',
  [LayerIcon.Link]: '<g transform="rotate(-45 8 8)"><path d="M7 5.75 H4.75 A2.25 2.25 0 0 0 4.75 10.25 H7"/><path d="M9 5.75 H11.25 A2.25 2.25 0 0 1 11.25 10.25 H9"/><line x1="5.75" y1="8" x2="10.25" y2="8"/></g>',
  [LayerIcon.Button]: '<g><rect x="1.75" y="4.5" width="12.5" height="7" rx="2"/><line x1="9.75" y1="4.5" x2="9.75" y2="11.5"/><line x1="4" y1="8" x2="7.5" y2="8"/><path d="M11.25 7.75 L12 8.5 L12.75 7.75"/></g>',
  [LayerIcon.Image]: '<g><rect x="2" y="2.75" width="12" height="10.5" rx="2"/><circle cx="5.625" cy="5.875" r="1"/><path d="M2.25 12.25 L6 8.5 L9.25 11.75"/><path d="M8.25 10.75 L10.25 8.75 L13.75 12.25"/></g>',
  [LayerIcon.Vector]: '<g><path d="M5.85 5.5 L10.15 5.5 C10.519 5.5 10.859 5.704 11.032 6.029 L12.411 8.614 C12.613 8.994 12.55 9.461 12.253 9.773 L8 14.25 L3.747 9.773 C3.45 9.461 3.387 8.994 3.589 8.614 L4.968 6.029 C5.141 5.704 5.481 5.5 5.85 5.5 Z"/><line x1="5.75" y1="2.75" x2="10.25" y2="2.75"/><circle cx="8" cy="8.5" r="0.55" fill="currentColor" stroke="none"/><line x1="8" y1="10.75" x2="8" y2="14.25"/></g>',
  [LayerIcon.Video]: '<g><rect x="1.75" y="4" width="9" height="8" rx="2"/><path d="M11.117 6.764 L13.017 5.542 C13.55 5.2 14.25 5.582 14.25 6.215 L14.25 9.785 C14.25 10.418 13.55 10.8 13.017 10.458 L11.117 9.236 C10.888 9.089 10.75 8.835 10.75 8.563 L10.75 7.437 C10.75 7.165 10.888 6.911 11.117 6.764 Z"/></g>',
  [LayerIcon.Input]: '<g><rect x="1.75" y="3.75" width="12.5" height="8.5" rx="2"/><line x1="5" y1="6.25" x2="5" y2="9.75"/></g>',
  [LayerIcon.Form]: '<g><rect x="3.25" y="3.25" width="9.5" height="9.5" rx="1"/></g>',
  [LayerIcon.List]: '<g><circle cx="2.75" cy="3.75" r="0.55" fill="currentColor" stroke="none"/><circle cx="2.75" cy="8" r="0.55" fill="currentColor" stroke="none"/><circle cx="2.75" cy="12.25" r="0.55" fill="currentColor" stroke="none"/><line x1="6" y1="3.75" x2="13.25" y2="3.75"/><line x1="6" y1="8" x2="13.25" y2="8"/><line x1="6" y1="12.25" x2="13.25" y2="12.25"/></g>',
  [LayerIcon.Nav]: '<g><line x1="2.75" y1="3.75" x2="13.25" y2="3.75"/><line x1="2.75" y1="8" x2="13.25" y2="8"/><line x1="2.75" y1="12.25" x2="13.25" y2="12.25"/></g>',
  [LayerIcon.Header]: '<g><rect x="2.25" y="2.25" width="11.5" height="4" rx="1"/><path d="M2.25 8.5 L2.25 11.75 C2.25 12.855 3.145 13.75 4.25 13.75 L11.75 13.75 C12.855 13.75 13.75 12.855 13.75 11.75 L13.75 8.5"/></g>',
  [LayerIcon.Footer]: '<g><path d="M2.25 7.5 L2.25 4.25 C2.25 3.145 3.145 2.25 4.25 2.25 L11.75 2.25 C12.855 2.25 13.75 3.145 13.75 4.25 L13.75 7.5"/><rect x="2.25" y="9.75" width="11.5" height="4" rx="1"/></g>',
  [LayerIcon.Component]: '<g><path d="M8.424 2.174 L9.576 3.326 C9.81 3.56 9.81 3.94 9.576 4.174 L8.424 5.326 C8.19 5.56 7.81 5.56 7.576 5.326 L6.424 4.174 C6.19 3.94 6.19 3.56 6.424 3.326 L7.576 2.174 C7.81 1.94 8.19 1.94 8.424 2.174 Z"/><path d="M12.674 6.424 L13.826 7.576 C14.06 7.81 14.06 8.19 13.826 8.424 L12.674 9.576 C12.44 9.81 12.06 9.81 11.826 9.576 L10.674 8.424 C10.44 8.19 10.44 7.81 10.674 7.576 L11.826 6.424 C12.06 6.19 12.44 6.19 12.674 6.424 Z"/><path d="M8.424 10.674 L9.576 11.826 C9.81 12.06 9.81 12.44 9.576 12.674 L8.424 13.826 C8.19 14.06 7.81 14.06 7.576 13.826 L6.424 12.674 C6.19 12.44 6.19 12.06 6.424 11.826 L7.576 10.674 C7.81 10.44 8.19 10.44 8.424 10.674 Z"/><path d="M4.174 6.424 L5.326 7.576 C5.56 7.81 5.56 8.19 5.326 8.424 L4.174 9.576 C3.94 9.81 3.56 9.81 3.326 9.576 L2.174 8.424 C1.94 8.19 1.94 7.81 2.174 7.576 L3.326 6.424 C3.56 6.19 3.94 6.19 4.174 6.424 Z"/></g>',
  [LayerIcon.Repeat]: '<g><path d="M2.75 7.5 V6.5 A2.25 2.25 0 0 1 5 4.25 H13.25"/><path d="M11 2 L13.25 4.25 L11 6.5"/><path d="M13.25 8.5 V9.5 A2.25 2.25 0 0 1 11 11.75 H2.75"/><path d="M5 9.5 L2.75 11.75 L5 14"/></g>',
  [LayerIcon.Head]: '<g><path d="M5.25 4 L1.75 8 L5.25 12"/><path d="M10.75 4 L14.25 8 L10.75 12"/><line x1="9.25" y1="2.75" x2="6.75" y2="13.25"/></g>',
  [LayerIcon.Textarea]: '<g><rect x="2.25" y="2.75" width="11.5" height="10.5" rx="2"/><line x1="4.75" y1="5.75" x2="11.25" y2="5.75"/><line x1="4.75" y1="8.25" x2="9.25" y2="8.25"/><line x1="11.75" y1="8.75" x2="8.75" y2="11.75"/><line x1="11.75" y1="11" x2="11" y2="11.75"/></g>',
  [LayerIcon.Select]: '<g><rect x="1.75" y="3.75" width="12.5" height="8.5" rx="2"/><line x1="4.5" y1="8" x2="6.5" y2="8"/><path d="M8.75 7.25 L10.25 8.75 L11.75 7.25"/></g>',
  [LayerIcon.Instance]: '<g><path d="M8.707 2.707 L13.293 7.293 C13.683 7.683 13.683 8.317 13.293 8.707 L8.707 13.293 C8.317 13.683 7.683 13.683 7.293 13.293 L2.707 8.707 C2.317 8.317 2.317 7.683 2.707 7.293 L7.293 2.707 C7.683 2.317 8.317 2.317 8.707 2.707 Z"/><path d="M8.424 6.174 L9.826 7.576 C10.06 7.81 10.06 8.19 9.826 8.424 L8.424 9.826 C8.19 10.06 7.81 10.06 7.576 9.826 L6.174 8.424 C5.94 8.19 5.94 7.81 6.174 7.576 L7.576 6.174 C7.81 5.94 8.19 5.94 8.424 6.174 Z"/></g>',
  [LayerIcon.Title]: '<g><line x1="4" y1="2.75" x2="4" y2="13.25"/><line x1="12" y1="2.75" x2="12" y2="13.25"/><line x1="4" y1="8" x2="12" y2="8"/></g>',
  [LayerIcon.Floating]: '<g><rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2" stroke-dasharray="1.5 1.5"/><rect x="5.75" y="5.75" width="4.5" height="4.5" rx="1"/></g>',
  [LayerIcon.Meta]: '<path d="M6 5L3 8l3 3M10 5l3 3-3 3"/>'
};

const BY_TAG: Record<string, LayerIcon> = {
  h1: LayerIcon.H1,
  h2: LayerIcon.H2,
  h3: LayerIcon.H3,
  h4: LayerIcon.H4,
  h5: LayerIcon.H5,
  h6: LayerIcon.H6,
  p: LayerIcon.Text,
  blockquote: LayerIcon.Text,
  span: LayerIcon.Inline,
  strong: LayerIcon.Inline,
  em: LayerIcon.Inline,
  b: LayerIcon.Inline,
  i: LayerIcon.Inline,
  small: LayerIcon.Inline,
  code: LayerIcon.Inline,
  label: LayerIcon.Inline,
  a: LayerIcon.Link,
  button: LayerIcon.Button,
  img: LayerIcon.Image,
  picture: LayerIcon.Image,
  svg: LayerIcon.Vector,
  video: LayerIcon.Video,
  input: LayerIcon.Input,
  textarea: LayerIcon.Textarea,
  select: LayerIcon.Select,
  form: LayerIcon.Form,
  ul: LayerIcon.List,
  ol: LayerIcon.List,
  li: LayerIcon.List,
  nav: LayerIcon.Nav,
  header: LayerIcon.Header,
  footer: LayerIcon.Footer,
  section: LayerIcon.Block,
  main: LayerIcon.Block,
  article: LayerIcon.Block,
  aside: LayerIcon.Block,
  head: LayerIcon.Head,
  title: LayerIcon.Title,
  meta: LayerIcon.Meta,
  link: LayerIcon.Meta,
  script: LayerIcon.Meta,
  style: LayerIcon.Meta
};

const BY_LAYOUT: { test: (n: IconNode) => boolean; icon: LayerIcon }[] = [
  { test: (n) => /grid$/.test(n.display), icon: LayerIcon.Grid },
  { test: (n) => /flex$/.test(n.display) && n.direction.startsWith('column'), icon: LayerIcon.FlexColumn },
  { test: (n) => /flex$/.test(n.display), icon: LayerIcon.FlexRow }
];

const LAYOUT_TAGS = new Set(['section', 'main', 'article', 'aside', 'header', 'footer']);

export function iconOf(node: IconNode): LayerIcon {
  if (node.tag === 'head') {
    return LayerIcon.Head;
  }
  if (node.component) {
    return LayerIcon.Component;
  }
  if (node.count > 1) {
    return LayerIcon.Repeat;
  }
  if (FLOATS_OUT_OF_FLOW.has(node.position)) {
    return LayerIcon.Floating;
  }
  const tag = node.tag.toLowerCase();
  const layout = BY_LAYOUT.find((row) => row.test(node))?.icon;
  if (layout && (!BY_TAG[tag] || LAYOUT_TAGS.has(tag))) {
    return layout;
  }
  return BY_TAG[tag] ?? layout ?? LayerIcon.Block;
}

export const FLOAT_HINT: Record<Floating, string> = {
  [Floating.Absolute]: 'Absolute: placed relative to its nearest positioned parent',
  [Floating.Fixed]: 'Fixed: stays in place on the screen while the page scrolls',
  [Floating.Sticky]: 'Sticky: scrolls with the page, then sticks at its offset'
};

export const FLOAT_GLYPH: Record<Floating, string> = {
  [Floating.Absolute]: '<path d="M5 1v8M1 5h8"/><circle cx="5" cy="5" r="2"/>',
  [Floating.Fixed]: '<path d="M3.5 1h3l-.5 3 1.5 1.5h-6L3 4z M5 5.5V9"/>',
  [Floating.Sticky]: '<path d="M2 2h6M5 2v6"/>'
};
