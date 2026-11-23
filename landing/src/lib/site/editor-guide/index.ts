export enum GuideId {
  States = 'states',
  Breakpoints = 'breakpoints',
  Shared = 'shared',
  Snap = 'snap',
  Themes = 'themes',
  Attributes = 'attributes',
  Library = 'library',
  Changes = 'changes'
}

export type GuideFeature = {
  readonly id: GuideId;
  readonly title: string;
  readonly text: string;
  readonly lands: readonly string[];
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
};

const DIR = '/img/editor-guide';

export const GUIDE_COPY = {
  eyebrow: 'editor guide',
  heading: 'what the editor does',
  lead: 'Screenshots of the extension itself, on a React and Tailwind app.',
  landsLabel: 'lands in your code'
} as const;

export const GUIDE_FEATURES: readonly GuideFeature[] = [
  {
    id: GuideId.States,
    title: 'Interaction states',
    text: 'Pick hover, focus, focus visible, active or disabled, then edit. A dot marks the states that already have styles.',
    lands: ['hover:bg-blue-600', 'md:hover:bg-blue-600'],
    src: `${DIR}/state-open.webp`,
    width: 600,
    height: 520,
    alt: 'The State menu of the Feega Properties bar open on a button: Default, Hover, Focus, Focus visible, Active and Disabled, with a dot on Hover and Focus visible'
  },
  {
    id: GuideId.Breakpoints,
    title: 'One screen size at a time',
    text: 'Edit what follows the preview, every size, or one breakpoint read from your Tailwind config.',
    lands: ['md:px-7'],
    src: `${DIR}/breakpoint.webp`,
    width: 600,
    height: 460,
    alt: 'The breakpoint menu of the Feega Properties bar open: Follow the preview, All sizes, sm 640px, md 768px, lg 1024px, xl 1280px and 2xl 1536px'
  },
  {
    id: GuideId.Shared,
    title: 'Shared components',
    text: 'This element ×3 edits the component, so all three instances change. Detach, here or in the Layers right-click menu, copies it to change one usage only.',
    lands: ['Button.jsx', '<ButtonHome />'],
    src: `${DIR}/scope.webp`,
    width: 600,
    height: 240,
    alt: 'The scope toggle of the Feega editor on a button used three times: This element ×3 selected, and a bar reading Edits 3 instances with Detach, Dismiss and Don’t show again'
  },
  {
    id: GuideId.Snap,
    title: 'Snap to your theme',
    text: 'On Tailwind projects, spacing, size, radius and font size snap to your theme steps. Hold Alt for an exact value. An orange dot marks an off-theme value and applies the nearest step.',
    lands: ['p-[13px] → p-3'],
    src: `${DIR}/snap.webp`,
    width: 598,
    height: 226,
    alt: 'The Spacing section of the Feega Properties bar with a padding of 13 px and an orange dot marking it as off the Tailwind theme'
  },
  {
    id: GuideId.Themes,
    title: 'Themes and dark mode',
    text: 'Switch the preview between the themes your project defines, and edit inside the one you picked.',
    lands: ['dark:bg-blue-400'],
    src: `${DIR}/theme-dark.webp`,
    width: 1780,
    height: 660,
    alt: 'The Feega editor toolbar with the theme set to dark and the previewed page in its dark theme'
  },
  {
    id: GuideId.Attributes,
    title: 'Attributes',
    text: 'Edit alt, src and data attributes, choose from a list of options, and set CSS variable colours with a swatch.',
    lands: ['data-fit-options="cover, contain, fill"', "style={{ '--frame': '#3b82f6' }}"],
    src: `${DIR}/attributes.webp`,
    width: 598,
    height: 450,
    alt: 'The Attributes section of the Feega Properties bar on an image: alt and src text fields, a fit dropdown set to cover, and colour swatches for CSS variables'
  },
  {
    id: GuideId.Library,
    title: 'Library',
    text: 'Insert a section or a component into your page from the Library panel.',
    lands: ['the markup and styles, in your files'],
    src: `${DIR}/library.webp`,
    width: 436,
    height: 860,
    alt: 'The Library panel of the Feega editor listing sections with an Insert button: Announcement Bar, Bento Feature Grid, Blog Cards and Changelog Timeline'
  },
  {
    id: GuideId.Changes,
    title: 'Every edit is a diff',
    text: 'The Changes tab lists each edit with Open, Show diff and Revert. Undo works as in any editor.',
    lands: ['rounded-[14px]'],
    src: `${DIR}/changes.webp`,
    width: 600,
    height: 250,
    alt: 'The Changes tab of the Feega editor after one edit: 1 file changed, radius 14 in Button.jsx, with Open, Show diff and Revert links'
  }
];
