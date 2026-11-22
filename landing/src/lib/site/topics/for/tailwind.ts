import { figure, type Topic } from '../topic';
import { CHECKED, DOCS, FEEGA_SOURCE, MARKETPLACE, img } from '../shared';

export const TAILWIND: Topic = {
  title: 'Tailwind visual editor that writes classes to your code',
  description: 'Feega edits Tailwind visually: click an element, change padding or colour, and the class in your component changes. Keeps theme tokens and breakpoints.',
  heading: 'A Tailwind visual editor that changes the classes in your files',
  hook: 'Pick a value in the panel, get the matching utility class in your component.',
  short:
    'Feega turns each edit you make in its panel into the matching Tailwind utility class and writes it into the class or className of the element you clicked, using your theme tokens when they match and keeping the breakpoint prefixes you already have.',
  cover: figure(img('for', 'tailwind-cover'), 'Feega for Tailwind CSS: an ASCII-art card in orange and rainbow tones with the classes p-6 and rounded-lg on a black background'),
  sections: [
    {
      heading: 'How Feega decides to write Tailwind',
      html: `<p>When a project opens, Feega reads <code>package.json</code>. If <code>tailwindcss</code>, <code>@tailwindcss/vite</code> or <code>@tailwindcss/postcss</code> is listed in dependencies or devDependencies, style edits are written as classes. Otherwise they are written as CSS. If your setup is unusual, for example Tailwind installed at the root of a monorepo but not in the app, set <code>feegaInspect.styling</code> to <code>tailwind</code> and the detection is skipped.</p>
<p>The rest works the same in React, Next.js, SvelteKit and Vue: Feega finds the element's line through a tag it adds in development, then edits the class attribute on that line. In <code>.tsx</code> and <code>.jsx</code> files the attribute is <code>className</code>; everywhere else it is <code>class</code>.</p>`
    },
    {
      heading: 'One class swapped, the rest left in place',
      html: `<p>Each control in the panel owns a family of utilities. Padding owns <code>p-*</code>, <code>px-*</code>, <code>pt-*</code> and the rest; radius owns <code>rounded</code> and <code>rounded-*</code>; text colour owns <code>text-*</code> except sizes like <code>text-lg</code> and alignment like <code>text-center</code>. When you change a value, Feega finds the class of that family on the element and replaces it, keeping its position in the string. If there is none, it adds the new class at the end.</p>
<p>Your class order, your other utilities and your custom classes stay as they were. A diff from Feega usually touches one token in one attribute, which is what makes it easy to review.</p>
<p>Values come from your scale first. Padding of 24 pixels becomes <code>p-6</code> on the default scale. A colour that matches a <code>--color-*</code> variable in your <code>@theme</code> block becomes <code>bg-brand</code> rather than a hex code. When nothing matches, Feega writes an arbitrary value such as <code>bg-[#ff5100]</code>, so the result is still exact. From the colour picker you can also save a new colour as a variable: Feega adds it to your <code>@theme</code> block as <code>--color-name</code> (or as a <code>:root</code> variable) and uses the new class.</p>`,
      figure: figure(img('for', 'tailwind-diff'), 'A diff of a Tailwind className: p-4 is replaced by p-6 and bg-[#ff5100] by bg-brand, while flex, items-center and the other classes stay in place')
    },
    {
      heading: 'Breakpoints: the class that applies at the width you see',
      html: `<p>Tailwind is mobile-first: <code>p-4</code> applies everywhere, <code>md:p-8</code> from 768 pixels up. Feega knows the default breakpoints (sm 640, md 768, lg 1024, xl 1280, 2xl 1536) and the width of the preview. When you edit, it picks the class of that family that is active at the current width and changes that one, keeping its prefix.</p>
<p>So with <code>p-4 md:p-8</code>, an edit at the 1440 desktop size changes <code>md:p-8</code>, and an edit at the 390 phone size changes <code>p-4</code>. Your desktop stays as it was when you fix the phone, and the other way round. One thing to know: if the element has no class of that family yet, Feega adds a base class with no prefix, which applies at every width until a larger prefix overrides it.</p>`
    },
    {
      heading: 'What Feega will not rewrite',
      html: `<p><strong>Classes built in code.</strong> <code>cn()</code>, <code>clsx()</code>, <code>twMerge()</code>, template literals and Svelte or Vue class expressions are code. Feega reports "class is not a literal, not written" with the file and line, and leaves them for you. Libraries like shadcn/ui use <code>cn()</code> inside their primitives, so editing those needs a person.</p>
<p><strong>Variants other than width.</strong> <code>hover:</code>, <code>dark:</code> and <code>group-*</code> classes are not chosen by the breakpoint logic. Feega edits the class that is active for the width and leaves state variants alone.</p>
<p><strong>A v3 config theme.</strong> Tokens are read from CSS: <code>@theme</code> in Tailwind v4 and the variables in your global stylesheet. Feega reads <code>tailwind.config.js</code> for breakpoints and themes but not for tokens, so custom v3 theme names may come out as arbitrary values. The class still works; it just isn't your name for it.</p>
<p><strong>Raw HTML.</strong> Elements from <code>dangerouslySetInnerHTML</code>, <code>{@html}</code> or <code>v-html</code> have no line of their own. In Tailwind mode Feega refuses and says to style them from the parent.</p>`
    },
    {
      heading: 'Why classes and not inline styles',
      html: `<p>A visual editor could write <code>style="padding: 24px"</code> on everything, and the page would look right. It would also put a second styling system into a codebase that chose Tailwind, and the next person to read the file would have to reconcile the two. Feega writes what you would have typed. The panel shows computed values in pixels, and the file gets the utility.</p>`
    },
    {
      heading: 'Checking the result',
      html: `<p>Every write appears in the Changes list with the property, the new value and the file. Undo puts back the previous text, unless the file changed since, in which case Feega refuses and tells you. Because the result is a normal class change, your linter, Prettier's Tailwind plugin and code review all see the same thing they would see from a person.</p>`
    }
  ],
  checked: CHECKED,
  howChecked: `<p>We make Feega, so this is our own description. On 19 November 2026 we read the Feega 0.2.2 code that does the Tailwind work: dependency detection, the class families and breakpoint table, the token lookup that maps colours and pixel values to classes, and the variable writer for <code>@theme</code> and <code>:root</code>. The examples on this page follow that code and its tests. We did not test Tailwind v3 projects with large custom configs.</p>`,
  tryIt: [
    'Install Feega in your editor, or run npx feega in a project that uses Tailwind.',
    'Open the project with "Feega: Open from current workspace" and wait for the app to load.',
    'Click an element, switch the preview to phone width, and change its padding.',
    'Open Changes: one class changed, the md: and lg: ones untouched.'
  ],
  mistakes: [
    { q: 'Editing at desktop width to fix a phone layout.', a: 'Feega edits the class active at the width you see. Switch to a phone size first.' },
    { q: 'Expecting cn() calls to be rewritten.', a: 'They are code. Keep static utilities in a literal string where you can.' },
    { q: 'Saving colours as arbitrary values forever.', a: 'Use "save as variable" in the colour picker once; later edits will use the token.' },
    { q: 'Leaving detection on auto in a monorepo.', a: 'If Tailwind is only in the root package.json, set feegaInspect.styling to tailwind.' }
  ],
  questions: [
    { q: 'Does Feega support Tailwind v4?', a: 'Yes. It detects @tailwindcss/vite and @tailwindcss/postcss and reads colour tokens from your @theme block.' },
    { q: 'Does it handle responsive classes?', a: 'Yes. It edits the class active at the previewed width and keeps its sm:, md:, lg: or xl: prefix.' },
    { q: 'What if no class matches the value?', a: 'It writes an arbitrary value like bg-[#ff5100] or a pixel value in brackets, so the result is exact.' },
    { q: 'Does it work with shadcn/ui?', a: 'On your own markup, yes. Inside shadcn primitives classes go through cn(), which Feega does not rewrite.' },
    { q: 'Does it use AI to pick classes?', a: 'No. The mapping is a fixed table in open-source code. No model, no tokens.' }
  ],
  sources: [
    FEEGA_SOURCE,
    MARKETPLACE,
    DOCS,
    { label: 'Tailwind CSS: responsive design', href: 'https://tailwindcss.com/docs/responsive-design' },
    { label: 'Tailwind CSS: theme variables', href: 'https://tailwindcss.com/docs/theme' },
    { label: 'Tailwind CSS: detecting classes in source files', href: 'https://tailwindcss.com/docs/detecting-classes-in-source-files' }
  ],
  readNext: ['/for/react', '/for/nextjs', '/for/sveltekit', '/integrations/vscode', '/alternatives/visual-editor-for-your-codebase', '/download']
};
