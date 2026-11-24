export enum ChipIcon {
  Heading = 'heading',
  Text = 'text',
  Button = 'button',
  Link = 'link',
  Image = 'image',
  List = 'list',
  Box = 'box',
  Many = 'many'
}

export type ChipView = { icon: ChipIcon; name: string; place: string; title: string };

type TagLook = { name: string; icon: ChipIcon };

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

const TAG_LOOKS: Record<string, TagLook> = {
  ...Object.fromEntries(HEADING_TAGS.map((tag) => [tag, { name: `Heading ${tag[1]}`, icon: ChipIcon.Heading }])),
  p: { name: 'Paragraph', icon: ChipIcon.Text },
  span: { name: 'Text', icon: ChipIcon.Text },
  button: { name: 'Button', icon: ChipIcon.Button },
  a: { name: 'Link', icon: ChipIcon.Link },
  img: { name: 'Image', icon: ChipIcon.Image },
  svg: { name: 'Icon', icon: ChipIcon.Image },
  ul: { name: 'List', icon: ChipIcon.List },
  ol: { name: 'List', icon: ChipIcon.List },
  li: { name: 'List item', icon: ChipIcon.List },
  nav: { name: 'Navigation', icon: ChipIcon.List }
};

const FALLBACK_LOOK: TagLook = { name: 'Element', icon: ChipIcon.Box };
const MANY = /^Feega selection: (\d+ elements)/;
const SOURCE = /^source: (.+?):(\d+):\d+$/m;
const SELECTOR = /^selector: (.+)$/m;

const baseName = (file: string): string => file.split('/').at(-1) ?? file;

const titleOf = (context: string): string => {
  const many = context.match(MANY);
  if (many) {
    return many[1];
  }
  const source = context.match(SOURCE);
  const selector = context.match(SELECTOR);
  return source ? [`${source[1]}:${source[2]}`, selector?.[1]].filter(Boolean).join(' ') : '';
};

export const chipOf = (context: string | null): string | null => {
  const title = context === null ? '' : titleOf(context);
  return title || null;
};

export function chipView(context: string | null): ChipView | null {
  const title = chipOf(context);
  if (context === null || title === null) {
    return null;
  }
  const many = context.match(MANY);
  if (many) {
    return { icon: ChipIcon.Many, name: many[1], place: '', title };
  }
  const source = context.match(SOURCE)!;
  const tag = context.match(SELECTOR)?.[1].split('.')[0] ?? '';
  const look = TAG_LOOKS[tag] ?? FALLBACK_LOOK;
  return { icon: look.icon, name: look.name, place: `${baseName(source[1])}:${source[2]}`, title };
}
