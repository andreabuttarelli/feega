import { figure, type Topic } from '../topic';
import { CHECKED, DOCS, FEEGA_SOURCE, MARKETPLACE, img } from '../shared';

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
      heading: 'Install it',
      html: `<p>Open the Extensions view with <code>Ctrl+Shift+X</code> (<code>Cmd+Shift+X</code> on a Mac), search for Feega and install the one published by andreabuttarelli. The extension id is <code>andreabuttarelli.feega</code>. From a terminal, <code>code --install-extension andreabuttarelli.feega</code> does the same. The <a href="/download">download page</a> also has a button that opens VS Code straight on the install screen.</p>
<p>You need VS Code 1.90 or newer and Node 18 or newer, because Feega runs your project's dev server with your own Node. There is no account to create and nothing to configure before the first run.</p>
<p>Updates arrive through the Marketplace like any other extension. If you close the Feega panel, the dev server it started is kept for a short while, so reopening the panel is quick, and then stopped.</p>`
    },
    {
      heading: 'First run',
      html: `<p>Open your project folder in VS Code. Then pick one of three ways in:</p>
<ul><li>Run <strong>Feega: Open from current workspace</strong> from the command palette.</li><li>Right-click a folder in the Explorer and choose <strong>Design this folder with Feega</strong>. Useful in a monorepo, where the app lives in <code>apps/web</code>.</li><li>Right-click a <code>.svelte</code>, <code>.vue</code>, <code>.tsx</code>, <code>.jsx</code>, <code>.astro</code> or <code>.html</code> file and choose <strong>Design this page with Feega</strong>.</li></ul>
<p>Feega reads <code>package.json</code> and the config files to see which framework you use, installs dependencies if <code>node_modules</code> is missing (you can cancel), picks a free port and starts the dev server. For Vite-based apps it starts Vite itself with your config; for Next.js it runs your <code>dev</code> script with a small preload. Then the app opens in a panel next to your editor.</p>`,
      figure: figure(img('integrations', 'vscode-window'), 'A stylised VS Code window: a .tsx file on the left, the running app in the middle with a selected button outlined in orange, and the Feega properties bar on the right')
    },
    {
      heading: 'What the panel gives you',
      html: `<p>The panel is the app itself, live, with a thin layer of tools around it. In design mode a click selects an element, a breadcrumb shows its parents, and a layers tree lists the page. The right bar has the controls you know from Figma: size, padding and margin, layout and gap, typography, fills, borders, radius and shadows, plus a colour picker. In navigate mode clicks go to the app, so you can log in, open a menu or reach the page you want, then switch back.</p>
<p>A device bar switches the preview between full width, desktop 1440, laptop 1280, tablets, three phone widths and a custom size. Edits respect the width: with Tailwind, Feega changes the class active at that width; with CSS, the rule in the matching media query.</p>
<p>When you select an element, Feega can open its source in the other editor column, on the exact line. That is the quickest way to see what a change is about to touch.</p>`
    },
    {
      heading: 'Where the edits go',
      html: `<p>Each change is written to the file and line of the element you clicked. In a Tailwind project that means a utility class swapped in the <code>class</code> or <code>className</code> string. Without Tailwind, Svelte and Vue components get a rule in their <code>&lt;style&gt;</code> block, and React components get a CSS module. Text you type on the page replaces the literal text in the markup. Text that comes from a variable is refused with a pointer to where it comes from.</p>
<p>The Changes list in the panel keeps every step with the files it touched. Undo restores the file unless it changed since, in which case Feega refuses rather than overwrite. VS Code's own Source Control view shows the same edits as ordinary diffs.</p>`
    },
    {
      heading: 'Settings',
      html: `<p>Feega has four settings under <code>feegaInspect</code>:</p>
<ul><li><code>styling</code>: <code>auto</code>, <code>tailwind</code> or <code>css</code>. Auto checks for Tailwind in your dependencies.</li><li><code>devCommand</code>: the command that starts your dev server, if detection picks the wrong one.</li><li><code>defaultSize</code>: the preview size on open: full, desktop, tablet or phone.</li><li><code>telemetry</code>: anonymous usage counts (opens, edits, framework, styling system), never code or paths. It is also off whenever VS Code's own telemetry is off.</li></ul>`
    },
    {
      heading: 'Known limits in VS Code',
      html: `<p>We built and tested Feega on local folders. Remote development (SSH, WSL, dev containers, Codespaces) runs extensions on a different machine from the panel, and we have not checked that the preview and the dev server line up there, so we don't promise it. Click-to-source is verified on React and Vue with Vite, SvelteKit and Next.js. Feega starts other frameworks too, but editing there is untested. If you work in the browser instead of VS Code, <code>npx feega</code> opens the same editor in a tab.</p>`
    }
  ],
  checked: CHECKED,
  howChecked: `<p>We make Feega, so this page is the maker's description. On 19 November 2026 we read the 0.2.2 extension manifest (commands, menus, settings, the <code>^1.90.0</code> engine), the start-up code that detects frameworks and launches the dev server, and the code that opens a source line in the editor column. The Marketplace listing was checked the same day. Remote development is not covered and not claimed.</p>`,
  tryIt: [
    'Install Feega from the Extensions view, or run code --install-extension andreabuttarelli.feega.',
    'Open your project and run "Feega: Open from current workspace".',
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
    { q: 'Can I use it without VS Code?', a: 'Yes. Run npx feega in your project folder to open the same editor in the browser.' }
  ],
  sources: [
    MARKETPLACE,
    FEEGA_SOURCE,
    DOCS,
    { label: 'VS Code: extension marketplace', href: 'https://code.visualstudio.com/docs/editor/extension-marketplace' },
    { label: 'VS Code: command line interface', href: 'https://code.visualstudio.com/docs/configure/command-line' },
    { label: 'VS Code: remote development', href: 'https://code.visualstudio.com/docs/remote/remote-overview' }
  ],
  readNext: ['/integrations/cursor', '/integrations/vscodium', '/for/react', '/for/sveltekit', '/alternatives/onlook', '/download']
};
