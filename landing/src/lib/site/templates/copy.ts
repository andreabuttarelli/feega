import { TEMPLATES } from './library';
import { Category, Framework, type Faq, type HubFramework } from './template';

export type CategoryCopy = {
  readonly label: string;
  readonly noun: string;
  readonly title: string;
  readonly description: string;
  readonly heading: string;
  readonly lead: string;
  readonly paragraphs: readonly string[];
  readonly faq: readonly Faq[];
};

const countOf = (category: Category) => TEMPLATES.filter((t) => t.category === category).length;

export const CATEGORY_COPY: Readonly<Record<Category, CategoryCopy>> = {
  [Category.Section]: {
    label: 'Sections',
    noun: 'section',
    title: 'Free website sections: heroes, pricing, footers | Feega',
    description: `${countOf(Category.Section)} free website sections as Svelte, React, Vue, Astro and HTML code: heroes, navbars, pricing, FAQ and footers, with light and dark themes.`,
    heading: 'Free website sections',
    lead: `${countOf(Category.Section)} full-width page blocks, each in Svelte, React, Vue, Astro and HTML.`,
    paragraphs: [
      'A section is a full-width block of a page: a hero, a pricing table, a footer. The sections here cover the parts most marketing sites need, from navbars and heroes to FAQs, pricing, testimonials and footers, and most come in several layouts so you pick the one that fits your message instead of bending one template.',
      'Every section is self-contained. It brings its own scoped styles, reads colour, type and spacing from --feega-* tokens and has no dependencies, so dropping it into a SvelteKit, Next.js, Nuxt or Astro page does not pull in a UI library. Where a section would normally show people or logos, it shows clearly marked placeholders, never invented customers.',
      'Pick by job. A landing page usually needs a navbar and a hero, one proof section (stats, logos or testimonials), one explanation section (features, steps or a bento grid), pricing or a call to action, and a footer. Mix variants of the same type only when pages differ, because consistent spacing comes from the shared tokens.',
      'Layouts start from the phone and are checked for horizontal overflow from 360 to 1280 pixels. Text and fill token pairs meet WCAG AA contrast in light and dark.'
    ],
    faq: [
      { q: 'Are the sections really free?', a: 'Yes. Every section here is free to copy into your own projects, with no account.' },
      { q: 'Do the sections need a CSS framework?', a: 'No. Each one ships its own CSS and reads --feega-* custom properties, so it works with Tailwind or without it.' }
    ]
  },
  [Category.Component]: {
    label: 'Components',
    noun: 'component',
    title: 'Free UI components: tabs, modal, forms, toast | Feega',
    description: `${countOf(Category.Component)} free UI components in Svelte, React, Vue, Astro and HTML: tabs, modal, dropdown, form inputs, badges and toasts, accessible and themeable.`,
    heading: 'Free UI components',
    lead: `${countOf(Category.Component)} small interface parts, each in Svelte, React, Vue, Astro and HTML.`,
    paragraphs: [
      'A component is a small, reusable part of an interface: a badge, a set of form inputs, a tab list, a modal, a toast. These are the pieces you place inside sections and screens, and they are the ones people tend to get subtly wrong, so each one is built on the platform where it can be.',
      'The modal uses the native dialog element, the dropdown menu and the FAQ lean on details and summary, and the tab list follows the ARIA tabs pattern with arrow-key navigation. Where behaviour is simple, there is no script at all. The few items that need state keep it in the framework you picked.',
      'Components share the same --feega-* tokens as the sections, so changing the accent colour, radius or font in one place restyles everything on the page, in light and dark. Every item includes focus styles that follow the focus token and respects reduced motion.',
      'Use them as a starting point rather than a black box: the code is short, readable and yours to edit once copied. Form inputs include labels, hints and an error state, which is the part most quick implementations leave out.'
    ],
    faq: [
      { q: 'Can I use these components next to a UI library?', a: 'Yes. They are plain markup and scoped CSS with no runtime, so they sit next to any other library. Their class names start with fl- to avoid collisions.' },
      { q: 'Are they accessible?', a: 'They use native elements where possible and ARIA where needed, with visible focus. Always test with your own content and content-specific labels.' }
    ]
  },
  [Category.App]: {
    label: 'App UI',
    noun: 'app UI piece',
    title: 'Free app UI templates: dashboards, tables, forms | Feega',
    description: `${countOf(Category.App)} free app UI templates for Svelte, React, Vue, Astro and HTML: command palette, data table, sidebar layout, stats cards and settings forms.`,
    heading: 'Free app UI templates',
    lead: `${countOf(Category.App)} product screens and shells, each in Svelte, React, Vue, Astro and HTML.`,
    paragraphs: [
      'App UI is what sits behind the login: the shell, the navigation, the tables and the forms people use all day. These templates cover a sidebar layout and top bars, a command palette, a data table, stats cards, a notification list, an empty state, and the login and settings forms.',
      'They are denser than marketing sections on purpose: smaller type, tighter spacing and clear states for empty, unread and error cases. The sidebar layout stacks on top below 720 pixels, and the data table scrolls horizontally inside its card on narrow screens instead of breaking the page.',
      'Start with the shell (sidebar layout or a top bar), then fill the content area with stats cards, a data table or a notification list. Use the empty state wherever a list can have nothing in it yet, since it is the first thing a new user sees.',
      'Like every item in the library, they read --feega-* tokens, so an app and its marketing site can share one palette and one type scale, and both follow light and dark. The data shown is placeholder content to replace with your own.'
    ],
    faq: [
      { q: 'Do these include data fetching or routing?', a: 'No. They are presentation only, with placeholder data, so they work with any router, store or backend you already use.' },
      { q: 'Can I build a whole dashboard from them?', a: 'You can assemble a shell and common screens. Charts and complex grids are not part of the library.' }
    ]
  }
};

export const HUB_COPY = {
  lead: `${TEMPLATES.length} sections, components and app screens you copy into your project, in Svelte, React, Vue, Astro and plain HTML.`,
  paragraphs: [
    'This is the free Feega library. Every item has a live preview you can resize and switch between light and dark, the code in five flavours on the same page, and the list of tokens it reads. There is nothing to install and no account: just copy the code.',
    'Everything is built on one small set of --feega-* custom properties for colour, type, radius and spacing. Change the accent once and every item follows, in light and dark. Items have no dependencies, so they sit next to Tailwind, a UI library or plain CSS.',
    'Start from the categories if you know what you need, or from your framework if you want to see how the code reads in it.'
  ],
  faq: [
    { q: 'Are the templates free?', a: 'Yes. Every item in the library is free to copy and use in your own projects, under the Apache-2.0 license. Feega Cloud is planned to add Pro templates later.' },
    { q: 'Which frameworks are covered?', a: 'Svelte 5, React with TypeScript, Vue 3, Astro and plain HTML with CSS. Every item exists in all five, and the code is the same design in each.' },
    { q: 'Do I need Tailwind or a UI library?', a: 'No. Each item ships its own CSS and reads --feega-* tokens, so it works with or without Tailwind.' },
    { q: 'Can I change the colours and fonts?', a: 'Yes. Override the tokens on :root or on any ancestor element. Fonts are Inter Tight and Fragment Mono from Google Fonts, each page lists the weights it needs.' }
  ] satisfies readonly Faq[]
};

export type FrameworkSection = { readonly heading: string; readonly paragraphs: readonly string[] };

export type FrameworkCopy = {
  readonly label: string;
  readonly alsoFor: string;
  readonly title: string;
  readonly description: string;
  readonly heading: string;
  readonly lead: string;
  readonly sections: readonly FrameworkSection[];
  readonly faq: readonly Faq[];
  readonly guides: readonly { readonly label: string; readonly path: string }[];
};

const TOKENS_AND_FONTS = (where: string, fontTag: string): FrameworkSection => ({
  heading: 'Tokens and fonts',
  paragraphs: [
    `Every item reads its colours, radii, spacing and fonts from --feega-* custom properties. Add the shared tokens file once, ${where}, and override any token on :root (or on any ancestor) to retheme everything. Dark follows prefers-color-scheme, and data-theme="light" or data-theme="dark" on an element forces a theme for that subtree.`,
    `Items use two Google Fonts families, Inter Tight and Fragment Mono. Add one stylesheet link ${fontTag}, with the weights listed on each item page. Without it, the font tokens fall back to a system stack, so nothing breaks.`
  ]
});

const CUSTOMIZING = (unit: string): FrameworkSection => ({
  heading: 'Changing the content and the look',
  paragraphs: [
    `Each file is short and readable. Copy, links and lists sit in the markup or at the top of the ${unit}, so replacing the placeholder content is a find and replace. Class names start with fl- and are plain selectors, so you can restyle one item by editing its CSS, or override a token to change all of them at once.`,
    'Placeholder content is marked as such: testimonials, team members and logos use obvious stand-ins, so nothing invented ships by accident. Replace them before you publish.'
  ]
});

const FEEGA_EDITS = (file: string, style: string): FrameworkSection => ({
  heading: 'Editing them with Feega',
  paragraphs: [
    `Once an item is in your project it is ordinary ${file}, so the Feega extension edits it like any other component: click it in your running app, change spacing, colour or radius in the panel, and the change is written ${style}. Nothing is generated at runtime and no AI is involved. You review every edit as a diff.`
  ]
});

export const FRAMEWORK_COPY: Readonly<Record<HubFramework, FrameworkCopy>> = {
  [Framework.Svelte]: {
    label: 'Svelte',
    alsoFor: 'SvelteKit',
    title: 'Free SvelteKit sections and UI templates (Svelte 5) | Feega',
    description: 'Free, Svelte 5 native sections and UI components for SvelteKit: heroes, pricing, footers, forms and app shells. Token-based, light and dark.',
    heading: 'Free SvelteKit sections and UI templates',
    lead: 'Svelte 5 native, token-based and dependency-free: page sections and UI parts you copy into a SvelteKit project.',
    sections: [
      {
        heading: 'Why this exists for Svelte',
        paragraphs: [
          'React has had large catalogues of ready-made page sections for years. For Svelte the choices are fewer, and most of what exists is aimed at a different job. This is our reading of the public documentation in November 2026, so check each project for what it covers today.',
          'shadcn-svelte is a community port of shadcn/ui: components you copy into your project, built on Bits UI and Tailwind CSS, installed through a command-line tool. Skeleton is a design system for Tailwind with themes, styled components and interactive Svelte components built on Zag.js. Flowbite Svelte is a component library for Tailwind CSS. All three are good at components and primitives such as buttons, dialogs, menus and forms, and all three assume Tailwind.',
          'Complete page sections, such as a hero, a pricing table with a billing toggle or a footer with a newsletter, are a different job from primitives, and check each project for what it offers today. The gap we kept meeting was free sections written for Svelte 5 first that need neither Tailwind nor a UI library. This library fills that gap, and it works in a project that already has one of the above and in one that has none.'
        ]
      },
      {
        heading: 'Svelte 5, the way you would write it',
        paragraphs: [
          'Each item is one .svelte file with TypeScript in a script block, plain markup and a scoped style block. Items that hold state use runes: the tab list and the toast use $state, and the command palette adds $derived for its filtered list. The modal uses bind:this with the native dialog element. Items that need no state have no script at all.',
          'No item touches window or document, and none registers a global listener, so they render the same on the server and in the browser and work with SvelteKit prerendering. There are no stores, no context and no props to learn: copy the file, import it, and replace the placeholder text.',
          'Place files in src/lib/components and import them in a route, for example import HeroSplit from "$lib/components/HeroSplit.svelte". Styles are scoped by Svelte and written with plain class selectors, so overriding them from your own CSS is straightforward.'
        ]
      },
      TOKENS_AND_FONTS('in src/app.css or a root +layout.svelte import', 'in the head of src/app.html'),
      FEEGA_EDITS('.svelte', "into the component's style block, or into the class if the project uses Tailwind"),
      {
        heading: 'Fit with SvelteKit',
        paragraphs: [
          'Items link with plain anchors and placeholder hrefs. Swap them for your own routes, or wrap them to use goto for client-side navigation. Forms are presentation: add an action in +page.server.ts and use:enhance when you connect one.'
        ]
      }
    ],
    faq: [
      { q: 'Does it work with Svelte 4?', a: 'The items are written for Svelte 5. The interactive ones use runes, so they will not run on Svelte 4.' },
      { q: 'Do I need Tailwind?', a: 'No. Items ship their own scoped CSS and read --feega-* tokens. They work in a Tailwind project too.' },
      { q: 'Is it free for commercial use?', a: 'Yes. The library is Apache-2.0: copy the code into your own projects. The tier on each item page says whether it is free.' }
    ],
    guides: [{ label: 'Feega for SvelteKit', path: '/for/sveltekit' }]
  },
  [Framework.React]: {
    label: 'React',
    alsoFor: 'Next.js',
    title: 'Free React and Next.js sections and UI templates | Feega',
    description: 'Free React sections and UI components in TypeScript for Next.js, Vite and React Router: heroes, pricing, footers, forms and app shells.',
    heading: 'Free React and Next.js sections and UI templates',
    lead: 'TSX components with a plain CSS file next to each one: no UI library, no runtime, works in Next.js and Vite.',
    sections: [
      {
        heading: 'What you get in React',
        paragraphs: [
          'Each item is a function component in a .tsx file with a sibling .css file imported at the top. There is no CSS-in-JS, no context provider and no dependency, so you can drop one into a Next.js app, a Vite project or React Router without changing your build.',
          'Items without behaviour are server-friendly markup. The four that hold state, the tab list, the modal, the toast and the command palette, use useState, useRef and useId, and keep ids unique so you can render the same item twice.'
        ]
      },
      {
        heading: 'Next.js App Router',
        paragraphs: [
          'Hooks need a client component. Add "use client" at the top of Tabs, Modal, Toast and CommandPalette when you use them in the App Router; every other item renders as a server component. Import the CSS file next to the component, which the App Router supports from any component, and import the tokens file once in your root layout.',
          'In the Pages Router, global CSS can only be imported from _app.tsx, so import the tokens file and each item stylesheet there.'
        ]
      },
      TOKENS_AND_FONTS('in your root layout or entry file', 'in the head, or with next/font if you prefer'),
      CUSTOMIZING('component'),
      FEEGA_EDITS('React code', 'to the CSS file next to the component, or to the className if the project uses Tailwind')
    ],
    faq: [
      { q: 'Does it work with Next.js?', a: 'Yes. Add "use client" to the four stateful items in the App Router. The others are plain markup.' },
      { q: 'Is there a TypeScript version?', a: 'Every React item is TSX. Rename to .jsx and drop the type annotations if you use plain JavaScript.' },
      { q: 'Does it use Tailwind or CSS modules?', a: 'Neither. Each item has a plain CSS file. Move it into a CSS module if you prefer.' }
    ],
    guides: [{ label: 'Feega for React', path: '/for/react' }, { label: 'Feega for Next.js', path: '/for/nextjs' }]
  },
  [Framework.Vue]: {
    label: 'Vue',
    alsoFor: 'Nuxt',
    title: 'Free Vue 3 and Nuxt sections and UI templates | Feega',
    description: 'Free Vue 3 sections and UI components with script setup and TypeScript for Nuxt and Vite: heroes, pricing, footers, forms and app shells.',
    heading: 'Free Vue and Nuxt sections and UI templates',
    lead: 'Vue 3 single-file components with script setup, TypeScript and scoped styles, ready for Nuxt and Vite.',
    sections: [
      {
        heading: 'What you get in Vue',
        paragraphs: [
          'Each item is one single-file component with a template and a scoped style block. Items that hold state use script setup with lang="ts" and the ref function; the rest are template and style only. There is no Options API, no plugin and no dependency.',
          'Scoped styles keep each item from leaking into your app, and the selectors are plain class selectors, so overriding them from your own CSS is straightforward. Interactive items such as tabs, toast and the command palette use ref and a keydown handler, with no external library.'
        ]
      },
      {
        heading: 'Nuxt and Vite',
        paragraphs: [
          'In Nuxt, put files in components/ and they are auto-imported by name, so HeroSplit.vue becomes <HeroSplit />. Add the tokens file to the css array in nuxt.config, and the Google Fonts link under app.head.link. Items render on the server and hydrate without extra setup.',
          'In a Vite project, import the component where you use it and import the tokens file in main.ts.'
        ]
      },
      TOKENS_AND_FONTS('in nuxt.config (css) or main.ts', 'in the head of index.html or through Nuxt app.head'),
      CUSTOMIZING('component'),
      FEEGA_EDITS('Vue code', "into the component's scoped style block, or into the class if the project uses Tailwind")
    ],
    faq: [
      { q: 'Does it work with Nuxt 3?', a: 'Yes. Components auto-import from the components folder, and there is nothing to register.' },
      { q: 'Is it Vue 3 only?', a: 'Yes. Items use script setup, which needs Vue 3.' },
      { q: 'Do I need a UI library?', a: 'No. Everything is plain markup, scoped CSS and tokens.' }
    ],
    guides: [{ label: 'Feega for Vue and Nuxt', path: '/for/vue' }]
  },
  [Framework.Astro]: {
    label: 'Astro',
    alsoFor: 'Astro',
    title: 'Free Astro sections and UI templates | Feega',
    description: 'Free Astro components for sections and UI parts: heroes, pricing, footers, forms and app shells. Zero JavaScript by default, token-based, light and dark.',
    heading: 'Free Astro sections and UI templates',
    lead: 'Astro components that ship no JavaScript unless an item needs behaviour, with scoped styles and shared tokens.',
    sections: [
      {
        heading: 'What you get in Astro',
        paragraphs: [
          'Each item is one .astro component: markup on top, a style block at the bottom. Most items ship no JavaScript at all, which suits Astro. The four with behaviour, the tab list, the modal, the toast and the command palette, include a small TypeScript script that Astro bundles and runs once per page, even if you use the item twice.',
          'Nothing needs a framework integration. You do not need React, Vue or Svelte installed to use these, and there are no islands to hydrate.'
        ]
      },
      {
        heading: 'Using them in a page',
        paragraphs: [
          'Place files in src/components and import them in a page or layout: import HeroSplit from "../components/HeroSplit.astro". Import the tokens file once in your base layout, and add the Google Fonts link in its head.'
        ]
      },
      TOKENS_AND_FONTS('in your base layout', 'in the layout head'),
      {
        heading: 'Static output and scoped styles',
        paragraphs: [
          "Items work with Astro's static output and with server rendering alike. Styles are scoped by Astro, so nothing leaks into other components, and the tokens file is the only global CSS they need."
        ]
      },
      CUSTOMIZING('component'),
      FEEGA_EDITS('Astro code', "into the component's style block, or into the class if the project uses Tailwind")
    ],
    faq: [
      { q: 'Do these add client JavaScript?', a: 'Only the four stateful items, with a few lines each. The rest are static HTML and CSS.' },
      { q: 'Do I need another framework for Astro?', a: 'No. They are plain .astro components with no framework integration.' }
    ],
    guides: []
  }
};
