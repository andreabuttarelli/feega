import { figure, type Topic } from '../topic';
import { EditorShotId } from '../../editor-shots';
import { CHECKED, DOCS, FEEGA_SOURCE, OPEN_VSX, img } from '../shared';

export const CURSOR: Topic = {
  title: 'Feega for Cursor: visual edits without spending tokens',
  description: 'Install Feega in Cursor from Open VSX. Click any element of your running app, edit it like in Figma, and the change goes to your code with no model call.',
  heading: 'Feega in Cursor: fix the look by hand, keep the agent for the logic',
  hook: 'Install from Open VSX, then make the small visual fixes without a prompt.',
  short:
    'Feega installs in Cursor from Open VSX and adds a panel where you click any element of your running app and change it like in Figma; the edit is written straight into your source file, with no prompt and no model call.',
  cover: figure(img('integrations', 'cursor-cover'), 'Feega for Cursor: an ASCII-art card in orange and rainbow tones with the words Cursor and Open VSX on a black background'),
  sections: [
    {
      heading: 'Install Feega in Cursor',
      html: `<p>Cursor installs third-party extensions from the Open VSX registry, and Feega is published there as <code>AndreaButtarelli/feega</code>. Open the Extensions view in Cursor, search for Feega and install it. The <a href="/download">download page</a> has a button that opens Cursor on the install screen through a <code>cursor:extension/andreabuttarelli.feega</code> link.</p>
<p>Feega is a regular VS Code extension and uses nothing specific to Microsoft's build, so it behaves in Cursor the way it does in VS Code. Your project needs Node 18 or newer, since Feega runs its dev server with your Node.</p>`
    },
    {
      heading: 'Why use a visual editor inside an AI editor',
      html: `<p>Cursor's agent is good at work that needs reading: wiring a form, writing a hook, refactoring a component. It is a slow way to move a button eight pixels. You describe the change, wait for a plan and a diff, look at the page, and often go round again because "a bit more space" means different things to you and to the model. Each round costs tokens.</p>
<p>Feega handles that last part by hand. You click the button in the running app, drag the padding until it looks right, and the class or CSS rule changes in the file. No prompt and no request to a model, so it costs nothing per edit. You keep the agent for the work it is good at and stop paying it to nudge spacing.</p>
<p>A common pattern is to let the agent build a page from a description, then open Feega and do the design pass yourself: spacing, type sizes, colours, radius, alignment at phone width.</p>`,
      editor: EditorShotId.Overview
    },
    {
      heading: 'How Feega and the agent share files',
      html: `<p>Both write to the same files on disk, and neither locks them. Feega writes only the line of the element you edit, and only when you edit. Cursor's agent sees those changes like any other edit, so its next diff starts from the updated file.</p>
<p>Undo is where the two could collide, and Feega checks for it. Each Feega step remembers the exact text it wrote. If the agent or you changed the file after that, Feega's undo refuses with "a file changed after the edit: not restored", instead of putting back an old version over newer work. Cursor's own checkpoints and Git still work as they always do.</p>
<p>If you ask the agent to restyle something, you may also want to say "keep the existing Tailwind classes where you can", so that Feega's tweaks aren't rewritten by a model that prefers its own class order.</p>`
    },
    {
      heading: 'First run in Cursor',
      html: `<p>Open your project and run <strong>Feega: Open from current workspace</strong> from the command palette, or right-click a folder or a page file in the explorer and pick the Feega item. Feega detects the framework, installs dependencies if they are missing, starts the dev server on a free port and opens the app beside your code.</p>
<p>Click to select, double-click to edit text, and use the right bar for layout, spacing, type, colour, borders and shadows. The device bar switches between desktop, tablet and phone widths. The Changes list keeps each step, and the source line can open in the other editor column so you see the file the edit lands in.</p>`
    },
    {
      heading: 'Settings worth knowing in Cursor',
      html: `<p>Feega's settings live in Cursor's settings like any extension's, under <code>feegaInspect</code>. Set <code>styling</code> to <code>tailwind</code> or <code>css</code> if detection guesses wrong, <code>devCommand</code> if your app starts with something other than the usual <code>dev</code> script, and <code>defaultSize</code> to <code>phone</code> if most of your design passes start on mobile. The anonymous usage counts follow both <code>feegaInspect.telemetry</code> and the editor's own telemetry setting.</p>`
    },
    {
      heading: 'Known limits',
      html: `<p>Cursor gets extensions from Open VSX, so a new Feega version shows up there when we publish it to Open VSX. Users have reported Cursor's copy of the registry lagging behind Open VSX for a while. If Cursor offers an older version than the <a href="/download">download page</a> lists, wait or install the <code>.vsix</code> from Open VSX.</p>
<p>Click-to-source is verified on React and Vue with Vite, SvelteKit, Next.js, Nuxt, React Router and Astro, and on Vite without a framework. Astro and Nuxt need Feega to start the dev server. Angular, plain HTML without Vite and Create React App are not supported. Class names built with <code>cn()</code> or <code>clsx()</code>, which AI-written code uses a lot, are not rewritten: Feega stops and shows the line. Remote and container setups are untested.</p>
<p>Cursor also has visual features of its own. We compared them in <a href="/alternatives/cursor-design-mode">Cursor design mode alternatives</a>. This page covers running Feega inside Cursor.</p>`
    }
  ],
  checked: CHECKED,
  howChecked: `<p>We make Feega, so this is the maker's account. On 19 November 2026 we checked that Feega 0.2.2 is listed on Open VSX, read Cursor's extension documentation on where it gets extensions, and read Feega's undo code to confirm how it treats files changed by someone else. We did not measure how many tokens an agent spends on visual tweaks, so read the comparison on this page as a description of the workflow.</p>`,
  tryIt: [
    'In Cursor, open Extensions, search for Feega and install it.',
    'Open your project and run "Feega: Open from current workspace".',
    'Click something the agent built and fix its spacing or colour in the right bar.',
    'Read the diff in Changes, then ask the agent for the next feature as usual.'
  ],
  mistakes: [
    { q: 'Prompting the agent for pixel nudges.', a: 'That is the slowest and most expensive way to do it. Make those edits in Feega.' },
    { q: 'Undoing a Feega step after the agent changed the same file.', a: 'Feega refuses on purpose. Use Git or Cursor checkpoints for that case.' },
    { q: 'Letting the agent wrap every className in cn().', a: 'Feega can only rewrite literal class strings. Ask for literal classes where nothing is conditional.' },
    { q: 'Installing from the Microsoft Marketplace page in Cursor.', a: 'Cursor uses Open VSX. Install from inside Cursor or from Open VSX.' }
  ],
  questions: [
    { q: 'Does Feega work in Cursor?', a: 'Yes. It installs from Open VSX and runs like it does in VS Code.' },
    { q: 'Does Feega use Cursor\'s AI or my tokens?', a: 'No. Feega makes no model calls. Edits are fixed mappings from the panel to classes or CSS.' },
    { q: 'Can the agent and Feega edit the same file?', a: 'Yes. Feega writes only the edited line, and its undo refuses if the file changed after its edit.' },
    { q: 'Is it free in Cursor?', a: 'Yes. Feega is free and open source under Apache-2.0.' }
  ],
  sources: [
    OPEN_VSX,
    FEEGA_SOURCE,
    DOCS,
    { label: 'Cursor docs: extensions', href: 'https://cursor.com/docs/configuration/extensions' },
    { label: 'Cursor forum: transition to Open VSX', href: 'https://forum.cursor.com/t/extension-marketplace-changes-transition-to-openvsx/109138' }
  ],
  readNext: ['/integrations/windsurf', '/integrations/vscode', '/alternatives/cursor-design-mode', '/alternatives/design-with-claude-code', '/for/nextjs', '/download']
};
