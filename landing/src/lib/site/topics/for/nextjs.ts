import { figure, type Topic } from '../topic';
import { CHECKED, DOCS, FEEGA_SOURCE, OPEN_VSX, img } from '../shared';

export const NEXTJS: Topic = {
  title: 'Edit a Next.js UI visually and save it to your code',
  description: 'Click any element of your Next.js app in dev, change it in a Figma-style panel, and Feega writes it to the .tsx file. Works with webpack and Turbopack.',
  heading: 'Edit a Next.js app visually, with the change saved in your code',
  hook: 'App Router or Pages Router, webpack or Turbopack: click, edit, get a diff.',
  short:
    'Feega runs your Next.js dev server with a small source loader added, so every element on the page knows its file and line; you click it, change it in a panel, and the edit is written to that .tsx file as a Tailwind class or a CSS module rule.',
  cover: figure(img('for', 'nextjs-cover'), 'Feega for Next.js: an ASCII-art card in orange and rainbow tones with the words Next.js and app/page.tsx on a black background'),
  sections: [
    {
      heading: 'How the source loader gets into Next.js',
      html: `<p>Feega does not ask you to edit <code>next.config</code>. When it sees <code>next</code> in your dependencies and a <code>next.config</code> file, it runs your own <code>dev</code> script with the host and port it picked, and adds one <code>--require</code> to <code>NODE_OPTIONS</code>. That preload file sits in <code>node_modules/.feega-inspect</code>, out of your source tree.</p>
<p>The preload waits for Next to load its config. In the development phase only, it adds a loader for <code>*.jsx</code> and <code>*.tsx</code> files: as a webpack rule that runs before the others and skips <code>node_modules</code>, and as Turbopack rules for the same two globs. So <code>next dev</code> and <code>next dev --turbopack</code> both get it. A production build runs without it, because the preload only acts in the dev phase and only when Feega starts the server.</p>
<p>The loader parses each file and adds <code>data-feega-src="app/page.tsx:12:5"</code> to every HTML element in the JSX. Components like <code>&lt;Hero /&gt;</code> are not tagged themselves; the elements inside <code>Hero.tsx</code> are, with Hero's lines. Feega also puts a small local proxy in front of the dev server, which adds the script the panel uses to talk to the page.</p>`
    },
    {
      heading: 'Server components, client components, both routers',
      html: `<p>The loader works on source files before React sees them, so it doesn't care where a component runs. A server component in <code>app/page.tsx</code> renders HTML with the attribute already on it. A client component marked <code>"use client"</code> renders it in the browser. Pages in <code>pages/</code> go through the same loader. In each case a click lands on the line that wrote the element.</p>
<p>What a server component can't give you is literal text when the text comes from a fetch. A heading that shows <code>{post.title}</code> has no words in the file to edit. Feega tells you the text comes from data and, when <code>post</code> is declared in the same file or a relative import, shows where. If it comes from a database or a CMS, you change it there.</p>`
    },
    {
      heading: 'What Feega writes in a Next.js project',
      html: `<p>New Next.js apps made with <code>create-next-app</code> usually include Tailwind through <code>@tailwindcss/postcss</code>. Feega detects that package and writes Tailwind classes into the <code>className</code> string: <code>gap-4</code> becomes <code>gap-6</code>, <code>text-sm</code> becomes <code>text-base</code>. If your theme defines a token for the value, it writes the token.</p>
<p>Without Tailwind, Feega writes CSS modules, which Next.js supports with no setup. It uses the module the component already imports, or creates <code>Hero.module.css</code> next to <code>Hero.tsx</code> and adds the import. Page-level styles, like the background of <code>body</code>, go into your global sheet: Feega looks for <code>app/globals.css</code> or <code>src/app/globals.css</code> first.</p>
<p>Picking a Google font in the panel adds an <code>@import</code> line to that global sheet and sets the font family. It does not rewrite <code>next/font</code> calls. If your project loads fonts with <code>next/font</code>, you may prefer to add the font there by hand and pick it in the panel afterwards.</p>`,
      figure: figure(img('for', 'nextjs-diff'), 'A diff of app/page.tsx in a Next.js project: the className on a hero heading changes from text-4xl to text-5xl tracking-tight, shown in red and green lines')
    },
    {
      heading: 'Known limits in Next.js',
      html: `<p><strong>Computed class names.</strong> <code>className={cn(...)}</code>, <code>clsx()</code> and template strings are not rewritten. Feega reports "class is not a literal, not written" and the line. shadcn/ui components use <code>cn()</code> heavily, so expect this inside <code>components/ui</code>. Your own page markup is usually literal and edits fine.</p>
<p><strong>Shared components.</strong> An edit inside <code>components/Button.tsx</code> changes every button. The panel shows the path, so check it before you change something shared.</p>
<p><strong>Pages behind a login.</strong> Feega opens your app as it runs. Switch to navigate mode, sign in the way you normally would, then switch back to design mode to edit.</p>
<p><strong>Custom dev commands.</strong> If your <code>dev</code> script wraps Next in something else (a monorepo runner, a custom server), set <code>feegaInspect.devCommand</code>. We have verified the loader with a plain <code>next dev</code>; custom servers may need that setting and we can't promise every setup.</p>`
    },
    {
      heading: 'Sizes and breakpoints',
      html: `<p>The preview opens at full width and has presets for desktop 1440, laptop 1280, tablets at 1024 and 768, and phones at 430, 390 and 375. With Tailwind, Feega changes the class that is active at the previewed width, so editing <code>lg:grid-cols-3</code> at 1440 leaves the phone layout alone. In CSS modules it edits the rule in the matching media query when one exists, otherwise the base rule.</p>`
    },
    {
      heading: 'Where the changes go and how to undo them',
      html: `<p>Each edit is saved as soon as you make it, so Next's fast refresh picks it up the way it would pick up your own typing. The Changes list keeps every step with the file it touched, and undo restores the previous text. If the file changed after the edit, undo stops and tells you, instead of overwriting your newer work. Because the edits are ordinary file changes, your normal review in Git still applies.</p>`
    }
  ],
  checked: CHECKED,
  howChecked: `<p>We make Feega, so this is our own product described by us. On 19 November 2026 we read the Feega 0.2.2 code that handles Next.js: the preload that wraps the config, the webpack and Turbopack rules it adds, and the JSX tagger they call. We also read the Next.js 15 fixture it is tested on, which uses the App Router and Tailwind through PostCSS. We did not test custom servers, Next.js versions before 15 or every monorepo layout.</p>`,
  tryIt: [
    'Install Feega in your editor, or run npx feega in the Next.js project folder.',
    'Run "Feega: Open from current workspace". Feega starts next dev with the loader and opens the app.',
    'Click a heading or a card in app/page.tsx and change its size or spacing.',
    'Look at the diff in Changes, then keep it or undo it.'
  ],
  mistakes: [
    { q: 'Adding the loader to next.config yourself.', a: 'Not needed. Feega adds it at start-up, in development only, and leaves the file alone.' },
    { q: 'Trying to edit shadcn/ui primitives with Tailwind classes.', a: 'Those use cn(), which Feega does not rewrite. Edit the markup that uses them, or change the primitive by hand.' },
    { q: 'Editing text that comes from a fetch.', a: 'That text is data. Change it at the source: the CMS, the database or the file Feega points to.' },
    { q: 'Expecting next/font to update.', a: 'Font picks go into the global stylesheet as an @import. Add next/font fonts in code.' }
  ],
  questions: [
    { q: 'Does Feega work with the App Router?', a: 'Yes. The loader tags elements in app/ and pages/ alike, in server and client components.' },
    { q: 'Does it work with Turbopack?', a: 'Yes. Feega adds Turbopack rules for .jsx and .tsx as well as a webpack rule, so both dev bundlers get the source tags.' },
    { q: 'Will it change my production build?', a: 'No. The loader is only added in the development phase of a server Feega starts. Your build config is not edited.' },
    { q: 'What does it write without Tailwind?', a: 'A CSS module next to the component, created and imported if it does not exist, plus page styles in app/globals.css.' }
  ],
  sources: [
    FEEGA_SOURCE,
    OPEN_VSX,
    DOCS,
    { label: 'Next.js: Turbopack configuration', href: 'https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack' },
    { label: 'Next.js: CSS modules', href: 'https://nextjs.org/docs/app/getting-started/css' },
    { label: 'Next.js: server and client components', href: 'https://nextjs.org/docs/app/getting-started/server-and-client-components' }
  ],
  readNext: ['/for/react', '/for/tailwind', '/templates/react', '/integrations/vscode', '/alternatives/cursor-design-mode', '/download']
};
