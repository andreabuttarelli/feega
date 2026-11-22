import { figure, type Topic } from '../topic';
import { EditorShotId } from '../../editor-shots';
import { CHECKED, DOCS, FEEGA_SOURCE, MARKETPLACE, img } from '../shared';

export const SVELTEKIT: Topic = {
  title: 'SvelteKit visual editor: edits saved to .svelte files',
  description: 'Feega is a free visual editor for SvelteKit. Click an element, edit it like in Figma, and the change goes into its class or the component\'s <style> block.',
  heading: 'A visual editor for SvelteKit that writes into your components',
  hook: 'Click an element, edit it, and the rule lands in the component <style> block.',
  short:
    'Feega starts your SvelteKit dev server with a source plugin, lets you click any element and change it in a panel, and writes the change into the .svelte file: a Tailwind class, or a rule in the component\'s own <style> block.',
  cover: figure(img('for', 'sveltekit-cover'), 'Feega for SvelteKit: an ASCII-art card in orange and rainbow tones with the words SvelteKit and +page.svelte on a black background'),
  sections: [
    {
      heading: 'How a click finds the line in a .svelte file',
      html: `<p>When Feega sees <code>@sveltejs/kit</code> in your dependencies, it starts Vite itself. It loads your <code>vite.config</code> as it is, with the <code>sveltekit()</code> plugin and anything else you have there, and puts its own source plugin first in the list. Nothing is written to your config.</p>
<p>The plugin parses each <code>.svelte</code> file with the Svelte compiler's parser, the modern AST from Svelte 5, and adds <code>data-feega-src="src/routes/+page.svelte:8:3"</code> to every regular HTML element. Components such as <code>&lt;PricingCard /&gt;</code> are not tagged themselves, and neither is <code>&lt;svelte:element&gt;</code>; the elements inside <code>PricingCard.svelte</code> carry PricingCard's lines.</p>
<p>So when you click a card title, Feega goes to the <code>&lt;h3&gt;</code> in <code>PricingCard.svelte</code> and leaves the page that used the card alone. That is the right place to change how cards look, and it also means every card changes. The panel shows the file path, so you can see this before you edit.</p>`,
      editor: EditorShotId.SvelteKit
    },
    {
      heading: 'What it writes: a class, or a rule in <style>',
      html: `<p>With Tailwind in the project (<code>tailwindcss</code> or <code>@tailwindcss/vite</code>), Feega edits the <code>class</code> attribute in place: <code>p-4</code> to <code>p-6</code>, <code>rounded</code> to <code>rounded-lg</code>, or a theme token when one matches.</p>
<p>Without Tailwind, Feega writes CSS the Svelte way, inside the component. If the element has no class, it gets one named after the component and the tag, like <code>pricing-card-div</code>; on a route file the plus sign is dropped, so <code>+page.svelte</code> gives <code>page-section</code>. Then Feega adds a rule for that class to the <code>&lt;style&gt;</code> block, creating the block at the end of the file if there isn't one. If the element already has a class Feega made earlier, it updates that rule instead of adding another.</p>
<p>If the element had an inline <code>style="..."</code>, those declarations move into the rule, so you don't end up with the same property in two places. Svelte scopes component styles by default, so the new rule affects this component only. And if you clear the last property of a rule, Feega deletes the rule, and the <code>&lt;style&gt;</code> block too when nothing is left.</p>`,
      figure: figure(img('for', 'sveltekit-diff'), 'A diff of PricingCard.svelte: a new class pricing-card-div on a div and a matching rule with padding and border-radius added to the style block')
    },
    {
      heading: 'Svelte syntax Feega leaves alone',
      html: `<p><strong>Class expressions.</strong> <code>class={active ? 'on' : 'off'}</code>, and the array and object forms Svelte 5 allows in <code>class={[...]}</code>, are code. Feega stops with "class is an expression, not written" and the line number. It won't guess what your expression means.</p>
<p><strong>class: directives.</strong> <code>class:active={isActive}</code> is untouched. Feega edits the literal <code>class="..."</code> next to it and leaves the directive as you wrote it.</p>
<p><strong>{@html} content.</strong> Markup injected with <code>{@html}</code> has no line in your file. When you style an element inside it, Feega writes the rule on the parent with a <code>:global(...)</code> selector, which is what Svelte needs to reach markup it didn't render. In Tailwind mode it refuses instead and tells you to style it from the parent's stylesheet.</p>
<p><strong>Text from load functions.</strong> <code>{data.title}</code> comes from <code>+page.ts</code> or <code>+page.server.ts</code>, or from further away. Feega says the text comes from data and, when it can find the declaration in the file or a relative import, points to it. Otherwise, change it where your load function gets it.</p>`
    },
    {
      heading: 'Each blocks and shared lines',
      html: `<p>Ten items rendered by <code>{#each items as item}</code> come from one element in the file. They share one source line, so editing one edits all ten. That matches how the code works. When a single item has to look different, add a field or a class condition in code, then come back to style it.</p>`
    },
    {
      heading: 'Page styles, fonts and breakpoints',
      html: `<p>Styles for <code>html</code> and <code>body</code> go into your global sheet. Feega looks for <code>src/app.css</code> first, which is where SvelteKit templates usually keep it. Picking a Google font adds an <code>@import</code> to that sheet. If there is no global sheet, Feega tells you the font is named but not loaded.</p>
<p>The preview has widths from 375 up to 1440 plus a custom size. In <code>&lt;style&gt;</code> blocks, Feega edits the rule inside the <code>@media</code> query that matches the previewed width when you have one, and the base rule otherwise. With Tailwind it edits the class active at that width, so <code>md:</code> classes change at desktop and base classes on a phone.</p>`
    },
    {
      heading: 'Review, undo and HMR',
      html: `<p>Vite's hot reload picks up each write the way it would pick up your own save, so the page updates in place. Every edit is listed in Changes with the file it touched. Undo restores the previous text, and refuses if the file changed since, so it never throws away something you or an agent typed later. No AI is involved and no account is needed.</p>`
    }
  ],
  checked: CHECKED,
  howChecked: `<p>We make Feega, and the Feega site you are reading is itself a SvelteKit app. On 19 November 2026 we read the Feega 0.2.2 code for Svelte: the tagger that walks the Svelte 5 AST, the scoped-rule writer for <code>&lt;style&gt;</code> blocks and the Tailwind class patcher. Every behaviour described here comes from that code and the tests that cover it. We did not test Svelte 4, which uses a different parser output; we don't promise it works there.</p>`,
  tryIt: [
    'Install Feega in VS Code, Cursor, Windsurf or VSCodium, or run npx feega in the project folder.',
    'Right-click src/routes and choose "Design this folder with Feega". Feega starts Vite and opens the app.',
    'Click an element and change its padding, radius or colour.',
    'Open the .svelte file or the Changes list to see the class or the new rule, then keep it or undo it.'
  ],
  mistakes: [
    { q: 'Editing an item inside an each block and expecting only that one to change.', a: 'They share a line. Add the difference in code first.' },
    { q: 'Using class={...} everywhere.', a: 'Expressions are not rewritten. Keep static classes in a literal class attribute and use class: directives for state.' },
    { q: 'Styling {@html} content with Tailwind.', a: 'Feega refuses there. Switch to CSS mode or add the classes to the HTML string yourself.' },
    { q: 'Running it on a Svelte 4 project and expecting the same result.', a: 'The tagger reads the Svelte 5 AST. Upgrade, or treat Svelte 4 as untested.' }
  ],
  questions: [
    { q: 'Does Feega work with Svelte 5 runes?', a: 'Yes. Runes live in the script, and Feega edits the markup and the style block, so they are not in its way.' },
    { q: 'Where do the CSS edits go?', a: 'Into the component\'s own <style> block, as a rule for a class Feega adds to the element. The block is created if it is missing.' },
    { q: 'Will it touch my svelte.config.js or vite.config.ts?', a: 'No. Feega loads your Vite config and adds its plugin in memory when it starts the dev server.' },
    { q: 'Does it work with plain Svelte on Vite, without SvelteKit?', a: 'Yes. A Vite project with .svelte files gets the same plugin and the same writers.' }
  ],
  sources: [
    FEEGA_SOURCE,
    MARKETPLACE,
    DOCS,
    { label: 'Svelte: scoped styles', href: 'https://svelte.dev/docs/svelte/scoped-styles' },
    { label: 'Svelte: class attribute and directives', href: 'https://svelte.dev/docs/svelte/class' },
    { label: 'SvelteKit: loading data', href: 'https://svelte.dev/docs/kit/load' }
  ],
  readNext: ['/for/vue', '/for/tailwind', '/integrations/vscode', '/templates/svelte', '/alternatives/visual-editor-for-your-codebase', '/download']
};
