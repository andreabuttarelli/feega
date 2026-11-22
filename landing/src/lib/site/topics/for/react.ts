import { figure, type Topic } from '../topic';
import { EditorShotId } from '../../editor-shots';
import { CHECKED, DOCS, FEEGA_SOURCE, MARKETPLACE, img } from '../shared';

export const REACT: Topic = {
  title: 'Visual editor for React: click the UI, edit the code',
  description: 'Feega is a free visual editor for React apps on Vite. Click an element, change it in a Figma-style panel, and the edit lands in your .tsx file.',
  heading: 'A visual editor for React that writes to your components',
  hook: 'Click an element in your Vite app, edit it, get a diff in the .tsx file.',
  short:
    'Feega lets you click any element of a running React app, change its spacing, colour, text or layout in a panel, and writes the change into the .tsx or .jsx file that rendered it, as a Tailwind class or a CSS module rule.',
  cover: figure(img('for', 'react-cover'), 'Feega for React: an ASCII-art card in orange and rainbow tones with the words React and .tsx on a black background'),
  sections: [
    {
      heading: 'How Feega finds the line in a React file',
      html: `<p>When you open a React project, Feega looks at <code>package.json</code> and the config files to work out how the app starts. For a Vite project (a plain <code>npm create vite</code> app, or React Router in framework mode) it starts Vite itself, with your own <code>vite.config</code> loaded as it is and one extra plugin placed first.</p>
<p>That plugin reads every <code>.jsx</code> and <code>.tsx</code> file with the Babel parser and adds one attribute to each HTML element in the markup: <code>data-feega-src="src/Pricing.tsx:14:7"</code>. File, line, column. When you click a <code>&lt;button&gt;</code> on the page, Feega reads that attribute and knows which line of which file to change.</p>
<p>Only lowercase tags get the attribute: <code>div</code>, <code>section</code>, <code>button</code>, <code>h1</code>. A component like <code>&lt;Card&gt;</code> is not an element in the browser, so it has no line of its own. The elements inside <code>Card.tsx</code> carry Card's lines instead. Click the title inside a card and you land in <code>Card.tsx</code>, on the <code>&lt;h3&gt;</code> that renders it.</p>
<p>The attribute exists only in the dev server Feega runs. Nothing is added to your source files to make this work, and a production build never sees it.</p>`,
      editor: EditorShotId.React
    },
    {
      heading: 'What it writes: Tailwind classes or a CSS module',
      html: `<p>Feega checks your dependencies once. If <code>tailwindcss</code>, <code>@tailwindcss/vite</code> or <code>@tailwindcss/postcss</code> is there, style edits become Tailwind classes. If not, they become CSS. You can force either one with the <code>feegaInspect.styling</code> setting.</p>
<p>With Tailwind, Feega edits the <code>className</code> string in place. Change the padding from 16 to 24 pixels and <code>p-4</code> becomes <code>p-6</code>; the other classes stay where they were. If the value matches a token in your theme, it uses the token name instead of a raw number. If no class of that kind exists yet, it adds one at the end.</p>
<p>Without Tailwind, a <code>.tsx</code> file gets a CSS module. If the component already imports one (<code>import styles from './Card.module.css'</code>), Feega adds or updates a rule there and keeps your import name. If it doesn't, Feega creates <code>Card.module.css</code> next to the component, adds the import line at the top, and gives the element a class like <code>className={styles.cardDiv}</code>. The result is plain CSS in the file a React developer would open first.</p>`,
      figure: figure(img('for', 'react-diff'), 'A before and after diff of Pricing.tsx: the className on a button changes from p-4 rounded-md to p-6 rounded-lg after an edit in the Feega panel')
    },
    {
      heading: 'Text, lists and data',
      html: `<p>Double-click a heading and type. If the words are written in the JSX (<code>&lt;h1&gt;Simple pricing&lt;/h1&gt;</code>), Feega changes them in the file. If the heading shows <code>{plan.name}</code>, there is no literal text to edit. Feega looks for where <code>plan</code> is declared, in the same file or in a relative import, and tells you: this text comes from data, <code>plans</code>, <code>plans.ts:3</code>. You go there and edit the array.</p>
<p>Lists work the same way. Three pricing cards rendered by <code>plans.map(...)</code> come from one line of JSX, so they share one <code>data-feega-src</code>. Change the padding of one card and all three change, because in your code they are one element. That is what you want most of the time. When you need one card to differ, the difference has to live in the data or in a prop, and that is a code decision Feega leaves to you.</p>`
    },
    {
      heading: 'Known limits in React',
      html: `<p><strong>Class names built by a function.</strong> <code>className={cn('p-4', active &amp;&amp; 'bg-black')}</code> is code, and Feega does not rewrite code it can't read with certainty. It stops and says "class is not a literal, not written", with the file and line. The same goes for template strings and <code>clsx()</code>. You can still use the panel to see the computed values, then make the change by hand.</p>
<p><strong>Global class names in CSS mode.</strong> If the project has no Tailwind and the element uses a plain string like <code>className="card"</code> from a global stylesheet, Feega won't guess which of your sheets owns <code>.card</code>. It refuses and points at the line.</p>
<p><strong>Edits inside a shared component.</strong> Because the tag lives in <code>Button.tsx</code>, a change applies to every button that component renders. Feega shows the file path before you edit, so you can see when you are about to change a shared piece.</p>
<p><strong>Other React setups.</strong> We verified click-to-source on Vite and on Next.js (it has <a href="/for/nextjs">its own page</a>). Feega can start other dev scripts, Create React App and Gatsby included, but we have not checked that clicks map to lines there, so we don't promise it. React Native is out of scope: there is no DOM to click.</p>`
    },
    {
      heading: 'Responsive edits',
      html: `<p>The preview has preset widths: desktop at 1440, laptop 1280, tablet 768 and 1024, phones at 430, 390 and 375, plus a custom width. With Tailwind, Feega edits the class that applies at the width you are looking at. If a card has <code>p-4 md:p-8</code> and you change it at 1440, the <code>md:p-8</code> changes. At 390 the base <code>p-4</code> changes. That follows Tailwind's mobile-first rules, so a phone edit can't break your desktop layout by accident. In CSS mode, Feega writes into the rule inside the media query that matches the preview width, if your module has one.</p>`
    },
    {
      heading: 'Review and undo',
      html: `<p>Every edit is a file change. The Changes list shows each one with the property, the value and the file, and undo puts the file back as it was. If the file changed after the edit (you typed in it, or an AI agent rewrote it), undo refuses rather than overwrite newer work. Git sees ordinary edits, so <code>git diff</code> shows exactly what moved. No model is called and nothing leaves your machine except anonymous usage counts, which you can turn off with <code>feegaInspect.telemetry</code>.</p>`
    }
  ],
  checked: CHECKED,
  howChecked: `<p>We make Feega, so this page describes our own product. On 19 November 2026 we read the Feega 0.2.2 source that does the work: the Babel pass that tags JSX elements, the class patcher used for Tailwind, and the CSS module writer. We also read the React and Vite fixture those parts are tested on, a pricing component with Tailwind classes, and the tests for the module writer that cover a component with no module yet. We did not test every React stack. Where we haven't checked something, this page says so.</p>`,
  tryIt: [
    'Install Feega from the Visual Studio Marketplace or Open VSX, or run npx feega in your project folder.',
    'Open the React project and run "Feega: Open from current workspace". Feega starts Vite and opens your app beside the code.',
    'Click a button or heading and change its padding or colour in the right bar.',
    'Open Changes to see the diff in the .tsx file, then keep it or undo it.'
  ],
  mistakes: [
    { q: 'Expecting one card in a list to change alone.', a: 'Items from .map() share one line of JSX. Make the difference a prop or a data field, then style it.' },
    { q: 'Editing inside a shared Button and forgetting it is shared.', a: 'Check the file path in the panel before you edit. If it says Button.tsx, every button changes.' },
    { q: 'Wondering why cn() classes are not written.', a: 'Feega only rewrites literal class strings. Move the static classes into a literal or make the change by hand.' },
    { q: 'Running a production build to edit.', a: 'The source tags only exist in the dev server Feega starts. Let Feega start the app.' }
  ],
  questions: [
    { q: 'Does Feega change my React code without asking?', a: 'It writes only the edit you make in the panel, to the file and line of the element you clicked. Each edit appears in Changes and can be undone.' },
    { q: 'Does it work with React Server Components?', a: 'On Next.js the source loader runs on every .tsx and .jsx file outside node_modules, so elements in server components carry their line too. See the Next.js page for details.' },
    { q: 'Do I need Tailwind?', a: 'No. Without Tailwind, Feega writes plain CSS into a CSS module next to the component and imports it for you.' },
    { q: 'Is it free?', a: 'Yes. The extension and npx feega are free and open source under Apache-2.0, with no account and no token costs.' }
  ],
  sources: [
    FEEGA_SOURCE,
    MARKETPLACE,
    DOCS,
    { label: 'Vite: plugin API', href: 'https://vite.dev/guide/api-plugin' },
    { label: 'React: rendering lists', href: 'https://react.dev/learn/rendering-lists' },
    { label: 'CSS Modules specification', href: 'https://github.com/css-modules/css-modules' }
  ],
  readNext: ['/for/nextjs', '/for/tailwind', '/integrations/vscode', '/templates/react', '/alternatives/onlook', '/download']
};
