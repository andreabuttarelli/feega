import { figure, type Topic } from '../topic';
import { EditorShotId } from '../../editor-shots';
import { CHECKED, DOCS, FEEGA_SOURCE, OPEN_VSX, img } from '../shared';

export const VSCODIUM: Topic = {
  title: 'Feega for VSCodium: open-source visual editing via Open VSX',
  description: 'Feega is on Open VSX, so VSCodium installs it like any extension. An open-source visual editor for your app in an open-source editor, with no model calls.',
  heading: 'Feega in VSCodium: an open-source visual editor in an open-source editor',
  hook: 'Install from Open VSX; no Microsoft Marketplace needed.',
  short:
    'VSCodium installs Feega from Open VSX, its default extension registry, and Feega runs there unchanged: click any element of your running app, edit it in a Figma-style panel, and the change is written to your source file.',
  cover: figure(img('integrations', 'vscodium-cover'), 'Feega for VSCodium: an ASCII-art card in orange and rainbow tones with the words VSCodium and Apache-2.0 on a black background'),
  sections: [
    {
      heading: 'Install from Open VSX',
      html: `<p>VSCodium is built from the VS Code source without Microsoft's branding, telemetry or licence, and it can't use the Visual Studio Marketplace. Its default registry is Open VSX, run by the Eclipse Foundation. Feega is published there as <code>AndreaButtarelli/feega</code>, so the Extensions view in VSCodium finds it with a search for Feega.</p>
<p>For machines without network access, download the <code>.vsix</code> file from the Open VSX page and install it with <code>codium --install-extension</code> followed by the file name, or with "Install from VSIX" in the Extensions view menu. The extension works offline once installed.</p>
<p>Feega needs the VS Code 1.90 extension API or newer, which current VSCodium releases provide, and Node 18 or newer for your project.</p>`
    },
    {
      heading: 'Why the pairing makes sense',
      html: `<p>People choose VSCodium to keep their editor free of things they didn't ask for. Feega fits that. The licence is Apache-2.0 and the code is on GitHub. There's no account, and your code stays on your machine. It doesn't call an AI model either: every edit is a fixed mapping from a panel control to a class or a CSS rule, in code you can read.</p>
<p>Feega does have one network feature: anonymous usage counts (how often it opens, how many edits, which framework and styling system), without code or file paths. They follow the editor's telemetry setting as well as Feega's own <code>feegaInspect.telemetry</code>. VSCodium turns telemetry off by default, so on a default install the counts are off too. Set <code>feegaInspect.telemetry</code> to false if you want to be sure.</p>
<p>The dev server Feega starts is your own project's server, bound to the local loopback address on a free port. The preview panel loads it from there. Nothing about your app goes through a Feega server, because there isn't one: the extension is the whole product, and Feega Cloud, when it comes, will be a separate and optional thing.</p>`
    },
    {
      heading: 'What you get after install',
      html: `<p>Run <strong>Feega: Open from current workspace</strong>, or right-click a folder or a page file and choose the Feega item. Feega works out the framework from <code>package.json</code>, installs missing dependencies if you let it, starts the dev server and opens the app beside your code.</p>
<p>From there it is the same editor as in VS Code. Click an element to select it, use the breadcrumb and the layers tree to move around, and change size, spacing, layout, type, colour, borders, radius and shadows in the right bar. Switch the preview between desktop, tablet and phone widths. Each edit is written to the file and line that rendered the element, listed in Changes, and undoable as long as nobody changed the file since.</p>`,
      editor: EditorShotId.Changes
    },
    {
      heading: 'What gets written',
      html: `<p>Tailwind projects get utility classes in the element's class string, using your theme tokens when they match. Svelte and Vue components without Tailwind get a rule in their <code>&lt;style&gt;</code> block. React and Next.js components without Tailwind get a CSS module next to the component. Literal text is edited in place. Text from variables and class names built by functions are left alone, and Feega tells you why with the file and line. The details are on the framework pages: <a href="/for/react">React</a>, <a href="/for/nextjs">Next.js</a>, <a href="/for/sveltekit">SvelteKit</a>, <a href="/for/vue">Vue</a> and <a href="/for/tailwind">Tailwind</a>.</p>`
    },
    {
      heading: 'Updates and versions',
      html: `<p>VSCodium checks Open VSX for extension updates the same way VS Code checks its marketplace, so Feega updates itself unless you have turned auto-update off. To stay on a version, use "Install Specific Version" from the extension's menu in the Extensions view and turn off auto-update for Feega. The <a href="/download">download page</a> and the <a href="/changelog">changelog</a> list the current version; at the time of writing it is 0.2.2.</p>
<p>Because the code is open, you can also build the extension yourself from the GitHub repository and install the resulting <code>.vsix</code>. That is the route for teams that only allow extensions they have built and reviewed in house. The build produces the same extension that we publish to Open VSX and the Visual Studio Marketplace.</p>`
    },
    {
      heading: 'Known limits',
      html: `<p>Open VSX gets Feega releases when we publish to it. If a version listed on the <a href="/download">download page</a> isn't in VSCodium yet, the <code>.vsix</code> on Open VSX is the fallback. We have not tested VSCodium's remote options. Click-to-source is verified on React and Vue with Vite, SvelteKit and Next.js; other frameworks start but are not something we promise yet.</p>
<p>If you'd rather not install anything in the editor, <code>npx feega</code> in the project folder opens the same editor in a browser tab.</p>`
    }
  ],
  checked: CHECKED,
  howChecked: `<p>We make Feega, so this is our own account. On 19 November 2026 we checked the Feega 0.2.2 listing on Open VSX, read VSCodium's documentation on its extension registry, and read Feega's manifest for its engine version and its telemetry setting, whose description says the counts are off whenever the editor's telemetry is off. We did not test VSCodium remote workspaces.</p>`,
  tryIt: [
    'In VSCodium, open Extensions, search for Feega and install it, or install the .vsix from Open VSX.',
    'Open your project and run "Feega: Open from current workspace".',
    'Click an element and change it in the right bar.',
    'Review the change in Changes, then keep it or undo it.'
  ],
  mistakes: [
    { q: 'Looking for Feega on the Microsoft Marketplace from VSCodium.', a: 'VSCodium uses Open VSX. Search from inside the editor or on open-vsx.org.' },
    { q: 'Assuming visual editors need a cloud account.', a: 'Feega runs locally with no account and no model calls.' },
    { q: 'Leaving the telemetry question unanswered.', a: 'Set feegaInspect.telemetry to false if you want it off whatever the editor says.' },
    { q: 'Opening the wrong folder in a monorepo.', a: 'Right-click the app folder and choose "Design this folder with Feega".' }
  ],
  questions: [
    { q: 'Does Feega work in VSCodium?', a: 'Yes. It is published on Open VSX, VSCodium\'s default registry, and uses only the standard extension API.' },
    { q: 'Does Feega send data?', a: 'Only anonymous usage counts, never code or paths, and they are off when the editor\'s telemetry is off.' },
    { q: 'Can I install it offline?', a: 'Yes. Download the .vsix from Open VSX and install it from file.' },
    { q: 'What licence is Feega under?', a: 'Apache-2.0. The source is on GitHub.' }
  ],
  sources: [
    OPEN_VSX,
    FEEGA_SOURCE,
    DOCS,
    { label: 'VSCodium documentation: extensions and Open VSX', href: 'https://github.com/VSCodium/vscodium/blob/master/docs/index.md' },
    { label: 'VSCodium home page', href: 'https://vscodium.com' },
    { label: 'Open VSX: about the registry', href: 'https://open-vsx.org/about' }
  ],
  readNext: ['/integrations/vscode', '/integrations/windsurf', '/for/sveltekit', '/for/vue', '/alternatives/visual-editor-for-your-codebase', '/download']
};
