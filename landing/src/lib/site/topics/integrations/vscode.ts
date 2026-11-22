import { figure, type Topic } from '../topic';
import { CHECKED, DOCS, FEEGA_SOURCE, MARKETPLACE, OPEN_VSX, img } from '../shared';

const SHOT_WIDTH = 1600;

export const VSCODE: Topic = {
  title: 'Feega for VS Code: a Figma-style editor for your app',
  description: 'Install Feega from the VS Code Marketplace, open your project, click any element of the running app and edit it. Changes are written to your source files.',
  heading: 'Feega in VS Code: design your running app next to its code',
  hook: 'Install from the Marketplace, open a project, click and edit.',
  short:
    'Feega is a free VS Code extension (andreabuttarelli.feega, VS Code 1.90 or newer) that starts your dev server, opens the running app in a panel beside your code, and writes every visual edit you make there back into the source file.',
  cover: figure(img('integrations', 'vscode-cover'), 'Feega for VS Code: an ASCII-art card in orange and rainbow tones with the words VS Code and andreabuttarelli.feega on a black background'),
  sections: [
    {
      heading: 'What it is',
      html: `<p>Feega is an extension that adds a visual editor to the editor you already write code in. You open your app, it runs in a panel next to your files, and you click what you want to change: a heading, a button, a card. The right bar shows the controls you would expect from a design tool. When you change a value, Feega finds the line of code that produced that element and edits it.</p>
<p>There is no model behind it. Feega makes no AI calls, so an edit costs no tokens and the same click gives the same change every time. The result is an ordinary edit to your own files, which you review in Source Control like any other.</p>`,
      figure: figure(img('integrations', 'vscode-shot-agent'), 'VS Code with the Feega panel open on a perfume shop page: the layers tree on the left, the running page with a selected button in the middle, the Properties bar next to it and a Claude Code panel on the right', { width: SHOT_WIDTH, height: 900 })
    },
    {
      heading: 'Install it',
      html: `<p>Open the Extensions view with <code>Ctrl+Shift+X</code> (<code>Cmd+Shift+X</code> on a Mac), search for Feega and install the one published by andreabuttarelli. The extension id is <code>andreabuttarelli.feega</code>. From a terminal, <code>code --install-extension andreabuttarelli.feega</code> does the same. The <a href="/download">download page</a> also has a button that opens VS Code straight on the install screen.</p>
<p>Cursor, Windsurf and VSCodium read from Open VSX instead of the Visual Studio Marketplace, and Feega is published there too. Search for the same name in their Extensions view, or see the pages for <a href="/integrations/cursor">Cursor</a>, <a href="/integrations/windsurf">Windsurf</a> and <a href="/integrations/vscodium">VSCodium</a>.</p>
<p>You need VS Code 1.90 or newer and Node 18 or newer, because Feega runs your project's dev server with your own Node. There is no account to create and nothing to configure before the first run. Updates arrive through the Marketplace like any other extension.</p>`
    },
    {
      heading: 'Open your app',
      html: `<p>Open your project folder, then pick one of these ways in:</p>
<ul><li>Right-click a folder in the Explorer and choose <strong>Design this folder with Feega</strong>. In a monorepo, right-click the app folder, for example <code>apps/web</code>.</li><li>Right-click a <code>.svelte</code>, <code>.vue</code>, <code>.tsx</code>, <code>.jsx</code>, <code>.astro</code> or <code>.html</code> file and choose <strong>Design this page with Feega</strong>.</li><li>Open the Command Palette with <code>Cmd+Shift+P</code> (<code>Ctrl+Shift+P</code> on Windows and Linux) and run <strong>Feega: Open from current workspace</strong>.</li><li>If your app is already running, run <strong>Feega: Open from URL…</strong> and paste its address, for example <code>http://localhost:5173</code>.</li></ul>
<p>For the first three, Feega reads <code>package.json</code> and the config files to see which framework you use, installs dependencies if <code>node_modules</code> is missing (you can cancel), picks a free port and starts the dev server. For Vite-based apps it starts Vite itself with your config; for Next.js it runs your <code>dev</code> script with a small preload. Then the app opens in a panel beside your editor. If you close the panel, the server Feega started stays warm for ten minutes by default, so reopening is quick.</p>`
    },
    {
      heading: 'What you can edit',
      html: `<p>In design mode a click selects an element, a breadcrumb walks you through its parents and siblings, and text is edited in place. In navigate mode clicks go to the app, so you can log in, open a menu or reach the page you want, then switch back.</p>
<p>The Properties bar covers the usual ground:</p>
<ul><li><strong>Size and layout:</strong> width and height, plus the display and flex sections for containers and for children of a flex parent.</li><li><strong>Spacing:</strong> padding and margin.</li><li><strong>Typography:</strong> font, weight, size, line height, letter spacing and alignment.</li><li><strong>Fill:</strong> solid colours and gradients, with a colour picker.</li><li><strong>Radius, stroke and effects:</strong> corner radius, borders, opacity, shadows and filters.</li><li><strong>Position and transform:</strong> placement, constraints and transforms.</li></ul>
<p>Beyond the box model, a few controls follow how real pages work. The <strong>State</strong> switch lets you edit hover, focus, focus-visible and active styles, and disabled on form controls, with a dot marking states that already have styles. The <strong>breakpoint</strong> choice decides which width an edit applies to: with Tailwind, Feega changes the class active at that width, and with CSS it writes the rule inside the matching media query. A <strong>theme</strong> menu switches the preview between the themes it finds in your project, so you can edit a page in the theme you care about.</p>`,
      figure: figure(img('integrations', 'vscode-shot-editor'), 'The Feega panel on its own: layers tree with a.cta selected, the Aurel perfume page with a dark Shop the collection button outlined in blue, and the Properties bar showing size, spacing, typography, fill, radius and opacity', { width: 1200, height: 957 })
    },
    {
      heading: 'Layers, structure and icons',
      html: `<p>The Layers tree lists the page as your code produced it, with an icon for each kind of element. Click a row to select it, and drag rows to reorder siblings; the change is a move in your source. The same actions are in the right-click menu on the page: <strong>Duplicate</strong>, <strong>Wrap in container</strong>, <strong>Unwrap</strong> and <strong>Delete</strong>, each with a keyboard shortcut. The <strong>Add</strong> button inserts text, a heading, a button, a link, an image or a container.</p>
<p>When you select an icon, an icon picker opens with a search box over a library of icons, plus a place to paste SVG markup or upload a file. Pick one and the icon in your code is replaced.</p>
<p>For lists rendered from data, such as a row of cards built from an array, the menu offers <strong>Add item</strong>, and moving an item reorders the entry in the data rather than only in the markup. Text that comes from a variable is refused with a pointer to where it comes from, instead of being overwritten with a literal.</p>`
    },
    {
      heading: 'Use it next to Claude Code or Cursor',
      html: `<p>Feega and a coding agent split the work well. The agent is good at logic and new components; Feega is faster for spacing, colour and type, and it spends no tokens. Two features connect them.</p>
<p><strong>Selection sync.</strong> When you select an element, Feega reveals its source in a text editor beside the panel, with the line selected, without taking focus. Agents that read the editor selection, such as Claude Code, Cursor, Copilot, Cline, Codex and Gemini CLI, then know which element you mean, so you can type "make this match the pricing button" without naming a file. The setting is <code>feegaInspect.syncSelection</code> and it is on by default.</p>
<p><strong>Copy for agent.</strong> Right-click an element, or use the button in the bar, and Feega copies a short description to the clipboard: file and line, selector, component, page, preview width, breakpoint, theme and state. Paste it into any agent that does not read the editor selection.</p>`,
      figure: figure(img('integrations', 'vscode-shot-diff'), 'The Claude Code panel beside Feega: a request to make the hero button match the pricing button, three tool steps, and a diff of src/lib/Hero.svelte that changes the class cta to site-pill', { width: 780, height: 710 })
    },
    {
      heading: 'Where the edits go',
      html: `<p>Each change is written to the file and line of the element you clicked. In a Tailwind project that means a utility class swapped in the <code>class</code> or <code>className</code> string, using your own tokens when a colour matches one. Without Tailwind, Svelte and Vue components get a rule in their <code>&lt;style&gt;</code> block, and files without a stylesheet, such as JSX or plain HTML, get an inline style. Text you type on the page replaces the literal text in the markup.</p>
<p>The Changes tab in the panel keeps every step with the files it touched. Undo restores the file unless it changed since, in which case Feega refuses rather than overwrite it. VS Code's Source Control view shows the same edits as ordinary diffs, so they go through your normal review and commit flow.</p>`
    },
    {
      heading: 'Frameworks',
      html: `<p>Feega works with React, Next.js, Svelte, SvelteKit, Vue, Nuxt, React Router, Astro and Vite, with Tailwind or plain CSS. Click-to-source is verified on React and Vue with Vite, SvelteKit, Next.js, Nuxt, React Router and Astro, and on Vite without a framework. Astro and Nuxt need Feega to start the dev server. Angular, plain HTML without Vite and Create React App are not supported. Other setups start, but editing there is less tested. Each has a page of its own: <a href="/for/react">React</a>, <a href="/for/nextjs">Next.js</a>, <a href="/for/sveltekit">SvelteKit</a>, <a href="/for/vue">Vue</a> and <a href="/for/tailwind">Tailwind</a>.</p>`
    },
    {
      heading: 'Settings, privacy and telemetry',
      html: `<p>Feega has six settings under <code>feegaInspect</code>:</p>
<ul><li><code>styling</code>: <code>auto</code>, <code>tailwind</code> or <code>css</code>. Auto uses Tailwind classes when the project has Tailwind.</li><li><code>devCommand</code>: the command that starts your dev server, if detection picks the wrong one.</li><li><code>defaultSize</code>: the preview size on open: full, desktop, tablet or phone.</li><li><code>keepServerAlive</code>: minutes the dev server stays warm after the panel closes: 0, 10, 30 or 60.</li><li><code>syncSelection</code>: reveal the selected element's source beside the panel.</li><li><code>telemetry</code>: anonymous usage counts.</li></ul>
<p>No account is needed and your code does not leave your machine. Telemetry carries a random install id, session start and end, the number of edits, session length, Feega version, editor, operating system and device kind. It never carries code, file names, paths, project names, URLs or the content of an edit. Turn it off with <code>feegaInspect.telemetry</code>, or by setting VS Code's own <code>telemetry.telemetryLevel</code> to off. With <code>npx feega</code>, set <code>FEEGA_TELEMETRY=0</code> or <code>DO_NOT_TRACK=1</code>.</p>`
    },
    {
      heading: 'Known limits in VS Code',
      html: `<p>We built and tested Feega on local folders. Remote development (SSH, WSL, dev containers, Codespaces) runs extensions on a different machine from the panel, and we have not checked that the preview and the dev server line up there, so we don't promise it. If you work in the browser instead of VS Code, <code>npx feega</code> opens the same editor in a tab.</p>`
    }
  ],
  checked: CHECKED,
  howChecked: `<p>We make Feega, so this page is the maker's description. On 20 November 2026 we read the 0.2.9 extension manifest (commands, menus, settings, the <code>^1.90.0</code> engine), its README, the panel's controls for properties, states, breakpoints, themes, layers, structure and icons, and the code that reveals a selected element's source beside the panel. Screenshots are from the running extension. The screenshot with the Claude Code panel shows an edit made by the agent, not by Feega. Remote development is not covered and not claimed.</p>`,
  tryIt: [
    'Install Feega from the Extensions view, or run code --install-extension andreabuttarelli.feega.',
    'Open your project and run "Feega: Open from current workspace", or "Feega: Open from URL…" if the app already runs.',
    'Click an element in the panel and change its spacing or colour.',
    'Check the diff in Changes or in Source Control, then keep it or undo it.'
  ],
  mistakes: [
    { q: 'Opening the monorepo root and getting the wrong app.', a: 'Right-click the app folder and use "Design this folder with Feega".' },
    { q: 'Starting the dev server yourself on a custom port first.', a: 'Let Feega start it, or set feegaInspect.devCommand so it runs the right script.' },
    { q: 'Editing in design mode when you meant to click a link.', a: 'Switch to navigate mode to use the app, then back to design mode to edit.' },
    { q: 'Expecting it to work over SSH or in Codespaces.', a: 'Remote setups are untested. Use a local checkout or npx feega.' }
  ],
  questions: [
    { q: 'Which VS Code version do I need?', a: 'VS Code 1.90 or newer, plus Node 18 or newer for your project.' },
    { q: 'Is the VS Code extension free?', a: 'Yes. It is free and open source under Apache-2.0, with no account.' },
    { q: 'Does it work offline?', a: 'Yes, once installed. Feega makes no model calls; the only network use is anonymous usage counts, which you can turn off.' },
    { q: 'Does it work in Cursor, Windsurf and VSCodium?', a: 'Yes. They run VS Code extensions, and Feega is on Open VSX, the registry they use.' },
    { q: 'Can I use it without VS Code?', a: 'Yes. Run npx feega in your project folder to open the same editor in the browser.' }
  ],
  sources: [
    MARKETPLACE,
    OPEN_VSX,
    FEEGA_SOURCE,
    DOCS,
    { label: 'VS Code: extension marketplace', href: 'https://code.visualstudio.com/docs/editor/extension-marketplace' },
    { label: 'VS Code: command line interface', href: 'https://code.visualstudio.com/docs/configure/command-line' },
    { label: 'VS Code: remote development', href: 'https://code.visualstudio.com/docs/remote/remote-overview' }
  ],
  readNext: ['/integrations/cursor', '/integrations/vscodium', '/for/react', '/for/sveltekit', '/alternatives/onlook', '/download']
};
