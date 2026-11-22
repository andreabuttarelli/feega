import { figure, type Topic } from '../topic';
import { EditorShotId } from '../../editor-shots';
import { CHECKED, DOCS, FEEGA_SOURCE, OPEN_VSX, img } from '../shared';

export const WINDSURF: Topic = {
  title: 'Feega for Windsurf: edit your app UI like in Figma',
  description: 'Feega installs in Windsurf from Open VSX. Click any element of your running app, change it in a Figma-style panel, and the edit lands in your source file.',
  heading: 'Feega in Windsurf: a design panel next to Cascade',
  hook: 'Open VSX install, then hands-on design edits next to Cascade.',
  short:
    'Feega is an Open VSX extension that runs in Windsurf: it starts your dev server, shows the running app in a panel, and turns each click-and-edit you make there into a change in your source file, without calling a model.',
  cover: figure(img('integrations', 'windsurf-cover'), 'Feega for Windsurf: an ASCII-art card in orange and rainbow tones with the words Windsurf and Open VSX on a black background'),
  sections: [
    {
      heading: 'Install Feega in Windsurf',
      html: `<p>Windsurf's documentation says it uses the Open VSX registry for extensions, and Feega is listed there as <code>AndreaButtarelli/feega</code>. Open the Extensions panel in Windsurf, search for Feega and install it. From the <a href="/download">download page</a>, the Windsurf button opens the editor on the install screen through a <code>windsurf:extension/andreabuttarelli.feega</code> link.</p>
<p>Your project needs Node 18 or newer. Feega has no account, no sign-in and no API key to paste. Updates come from Open VSX through Windsurf's normal extension updates, and the current version is on the <a href="/download">download page</a>.</p>`
    },
    {
      heading: 'Cascade writes the feature, you do the design pass',
      html: `<p>Cascade, Windsurf's agent, can build a settings page from a sentence. What it can't do well is read your mind about the gap between two cards, or the exact grey you had in mind for secondary text. Those edits take one look and one adjustment when you do them yourself, and several prompts when you describe them.</p>
<p>Feega gives you the hands-on part. Click the card in the running app, drag the gap, pick the grey, change the font weight. The edit goes to the line of the component that rendered the card, as the Tailwind class or CSS rule you would have typed. Cascade's next change starts from the file as you left it.</p>
<p>Nothing in that loop calls a model, so a visual tweak in Feega costs no credits and works offline.</p>`,
      editor: EditorShotId.Selected
    },
    {
      heading: 'Two writers, one file',
      html: `<p>Cascade and Feega both write to disk. Feega touches only the element you edit and only when you edit it, so it rarely gets in Cascade's way. The case to watch is undo. Every Feega step stores the text it wrote; if Cascade or you changed that file afterwards, Feega's undo refuses ("a file changed after the edit: not restored") instead of rolling the file back over newer work. For anything bigger, Git is the safety net, and Feega's edits show up there as small, readable diffs.</p>
<p>Agents tend to write <code>className={cn(...)}</code> or long template strings. Feega won't rewrite those, because they are code. If you plan to fine-tune a component in Feega, ask Cascade to keep static classes in a plain string.</p>`
    },
    {
      heading: 'What you can edit',
      html: `<p>Select any element on the page, or walk up to its parent with the breadcrumb. The right bar covers size, padding, margin, flex and grid layout, gap, typography, text and fill colour, borders, radius and shadows. Double-click text to change it in place when it is written in the markup. The device bar has desktop, laptop, tablet and phone widths, and edits apply to the class or media query active at that width.</p>
<p>Frameworks where clicks map to source today: React and Vue on Vite, SvelteKit, Next.js with webpack or Turbopack, Nuxt, React Router, Astro, and Vite without a framework. Astro and Nuxt need Feega to start the dev server. The framework pages explain what gets written in each: <a href="/for/react">React</a>, <a href="/for/nextjs">Next.js</a>, <a href="/for/sveltekit">SvelteKit</a>, <a href="/for/vue">Vue</a>.</p>`
    },
    {
      heading: 'A design pass after Cascade, step by step',
      html: `<p>Here is the order we use when an agent has just built a screen. Start at the phone width, 390 pixels, because that is where generated layouts break first. Check that nothing overflows sideways, then fix the spacing between sections, then the type sizes. With Tailwind, these edits change the base classes, which is what you want for mobile-first code.</p>
<p>Then switch to desktop, 1440 pixels. If the layout needs more room there, the edits go to the <code>md:</code> or <code>lg:</code> classes that already exist, so the phone version stays as you just left it. If there are none, you'll see Feega add a base class, which is your cue to decide whether the change belongs to every width.</p>
<p>Last, colours. If the agent wrote hex codes as arbitrary values, pick the colour in Feega's picker and save it as a variable once. Later edits will use the token, and the next screen Cascade builds can use it too if you tell it the token's name.</p>`
    },
    {
      heading: 'Known limits in Windsurf',
      html: `<p>Feega reaches Windsurf through Open VSX, so a new version appears after we publish it there. Windsurf adds Feega like any other extension; we have not tested remote workspaces in Windsurf. Windsurf has its own preview features, and we don't claim Feega works with them; it opens its own panel and dev server.</p>
<p>If Feega can't work out how your project starts (a custom script, a monorepo runner), set <code>feegaInspect.devCommand</code> in Windsurf's settings to the command you use.</p>`
    }
  ],
  checked: CHECKED,
  howChecked: `<p>We make Feega, so weigh this as the maker's view. On 19 November 2026 we read Windsurf's documentation on extensions and the Open VSX registry, checked Feega 0.2.2 on Open VSX, and read the parts of Feega's code that matter when another program writes the same files: the edit log and the undo check. We did not test Windsurf remote workspaces or Windsurf's own preview tools.</p>`,
  tryIt: [
    'Open Extensions in Windsurf, search for Feega and install it.',
    'Open your project and run "Feega: Open from current workspace".',
    'Click something Cascade built and adjust its spacing, colour or type.',
    'Look at the change in Changes or in Git, then go back to Cascade for the next feature.'
  ],
  mistakes: [
    { q: 'Describing pixel tweaks to Cascade.', a: 'Do them in Feega. It is faster and costs nothing.' },
    { q: 'Undoing in Feega after Cascade edited the file.', a: 'Feega refuses to protect the newer work. Use Git for that.' },
    { q: 'Expecting Feega to rewrite cn() calls.', a: 'It won\'t. Keep static classes in a literal string.' },
    { q: 'Trying Feega on a remote workspace first.', a: 'Start with a local folder; remote setups are untested.' }
  ],
  questions: [
    { q: 'Does Feega work in Windsurf?', a: 'Yes. Windsurf installs extensions from Open VSX, where Feega is published.' },
    { q: 'Does Feega use Windsurf credits?', a: 'No. Feega makes no model calls, so edits cost nothing.' },
    { q: 'Can Cascade and Feega edit the same component?', a: 'Yes. Feega writes only the edited line and refuses to undo over later changes.' },
    { q: 'Which frameworks work?', a: 'React and Vue on Vite, SvelteKit, Next.js, Nuxt, React Router, Astro and Vite, with Tailwind or plain CSS.' }
  ],
  sources: [
    OPEN_VSX,
    FEEGA_SOURCE,
    DOCS,
    { label: 'Windsurf docs: recommended extensions and Open VSX', href: 'https://docs.windsurf.com/windsurf/recommended-extensions' },
    { label: 'Open VSX registry', href: 'https://open-vsx.org' }
  ],
  readNext: ['/integrations/cursor', '/integrations/vscodium', '/for/vue', '/for/tailwind', '/alternatives/ai-site-builder-or-your-repo', '/download']
};
