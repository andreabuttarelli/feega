import { figure, type Topic } from '../topic';
import { EditorShotId } from '../../editor-shots';
import { CHECKED, DOCS, FEEGA_SOURCE, OPEN_VSX, img } from '../shared';

export const VUE: Topic = {
  title: 'Vue visual editor: click the page, edit the .vue file',
  description: 'Feega is a free visual editor for Vue 3 on Vite. Click an element, edit it like in Figma, and the change lands in the SFC template or its style block.',
  heading: 'A visual editor for Vue that writes to your single-file components',
  hook: 'Click an element in a Vue 3 app and the change lands in the .vue file.',
  short:
    'Feega tags every element of a Vue 3 app on Vite with the line of the .vue file that renders it, so you can click an element, edit it in a panel, and get the change written to that file as a Tailwind class or a CSS rule in the component\'s style block.',
  cover: figure(img('for', 'vue-cover'), 'Feega for Vue: an ASCII-art card in orange and rainbow tones with the words Vue and PricingCard.vue on a black background'),
  sections: [
    {
      heading: 'How Feega maps a click to a .vue line',
      html: `<p>For a Vue project on Vite, the kind <code>npm create vue</code> gives you, Feega starts Vite itself with your <code>vite.config</code> loaded unchanged and its own source plugin placed first. The plugin reads the template of each single-file component with <code>@vue/compiler-sfc</code>, the same parser Vue uses, and adds <code>data-feega-src="src/components/PricingCard.vue:4:5"</code> to each plain HTML element.</p>
<p>Components in the template, like <code>&lt;RouterLink&gt;</code> or <code>&lt;PricingCard&gt;</code>, are not tagged. The elements inside <code>PricingCard.vue</code> are, with that file's lines. A click on a card title goes to the <code>&lt;h3&gt;</code> in the card component, which is where its look is defined. Every card in the app shares that line, so they change together.</p>
<p>The tags live only in the dev server Feega runs. Your files and your build don't get them.</p>`,
      editor: EditorShotId.Vue
    },
    {
      heading: 'What it writes in a single-file component',
      html: `<p>With Tailwind in your dependencies, Feega edits the static <code>class="..."</code> attribute: it swaps <code>p-4</code> for <code>p-6</code> or adds a class when there was none of that kind, using a theme token when the value matches one.</p>
<p>Without Tailwind, the edit goes into the component. The element gets a class named after the file and the tag, such as <code>pricing-card-div</code>, and Feega writes a rule for it in the first <code>&lt;style&gt;</code> block of the file. If that block is <code>&lt;style scoped&gt;</code>, the rule is scoped like the rest of your component styles. If the file has no style block, Feega adds a plain <code>&lt;style&gt;</code> at the end. That new block is global; the class name is specific to the component, so clashes are unlikely, but add <code>scoped</code> yourself if you want Vue to scope it.</p>
<p>Inline <code>style="..."</code> declarations on the element move into the rule, so each property lives in one place. Clearing the last property removes the rule, and the block too when it ends up empty.</p>`,
      figure: figure(img('for', 'vue-diff'), 'A diff of PricingCard.vue: the static class on a div gains pricing-card-div and a rule with padding 24px and border-radius 12px is added inside style scoped')
    },
    {
      heading: 'Bindings, directives and v-html',
      html: `<p><strong>:class bindings.</strong> <code>:class="{ active: isActive }"</code> is untouched. Feega edits the static <code>class</code> attribute next to it, which Vue merges with the binding at runtime. So you can keep state in the binding and the look in the static classes.</p>
<p><strong>v-for.</strong> Items rendered by <code>v-for</code> come from one element in the template and share its line. Editing one edits all of them. If one item should look different, add that in code first.</p>
<p><strong>v-html.</strong> Content injected with <code>v-html</code> has no line in your file. In CSS mode Feega styles it from the parent with a <code>:deep(...)</code> selector, which is how Vue lets a scoped rule reach into markup it didn't render. In Tailwind mode it refuses and tells you to style it from the parent's stylesheet.</p>
<p><strong>Interpolated text.</strong> <code>{{ plan.name }}</code> is data. Feega tells you so and, if <code>plan</code> is declared in the script or a relative import, points to the line. Literal text in the template is edited in place.</p>`
    },
    {
      heading: 'What about Nuxt?',
      html: `<p>Nuxt 4 works. Feega starts <code>nuxt dev</code> itself and adds the source plugin to Nuxt's build, so a click on the page maps to the line in <code>app.vue</code> or the component that renders it. Attaching to a Nuxt server you started yourself does not map elements, so let Feega start it.</p>`,
      editor: EditorShotId.Nuxt
    },
    {
      heading: 'Preprocessors, page styles and widths',
      html: `<p>Feega writes plain CSS declarations. Those are valid inside <code>&lt;style lang="scss"&gt;</code> too, so an SCSS block accepts them. We haven't tested <code>&lt;style module&gt;</code>; CSS modules in Vue rename classes at build time, and Feega's class names would not match, so use scoped styles or Tailwind with Feega.</p>
<p>Styles for <code>html</code> and <code>body</code> go into your global sheet. In a Vite Vue app that is often <code>src/assets/main.css</code>, which is on Feega's list of places to look. The preview has widths from 375 to 1440 plus custom, and edits go to the media query or the Tailwind breakpoint that applies at the width you see.</p>`
    },
    {
      heading: 'Undo and review',
      html: `<p>Every write shows up in Changes with the file it touched, and Vite's hot reload updates the page. Undo puts the file back. If the file changed after the edit, undo refuses so it can't overwrite later work. There is no AI and no account, and the code stays on your machine.</p>`
    }
  ],
  checked: CHECKED,
  howChecked: `<p>We make Feega, so take this as the maker's account. On 19 November 2026 we read the Feega 0.2.2 code for Vue: the template tagger built on <code>@vue/compiler-sfc</code>, the style-block writer and the start-up rules that decide how each framework is launched, Every behaviour described comes from that code and its tests. We did not test Vue 2 or <code>&lt;style module&gt;</code>.</p>`,
  tryIt: [
    'Install Feega from Open VSX or the Visual Studio Marketplace, or run npx feega in the Vue project.',
    'Run "Feega: Open from current workspace". Feega starts Vite and opens the app next to your code.',
    'Click a card or a button and change its spacing or colour.',
    'Check the .vue file or the Changes list, then keep the edit or undo it.'
  ],
  mistakes: [
    { q: 'Expecting a :class binding to be edited.', a: 'Bindings are code. Feega edits the static class attribute, which Vue merges with the binding.' },
    { q: 'Assuming the new <style> block is scoped.', a: 'A block Feega creates is plain <style>. Add scoped if you want it.' },
    { q: 'Trying it on Nuxt and getting no edits.', a: 'Let Feega start the Nuxt dev server. A server you started yourself is not mapped to source.' },
    { q: 'Editing one v-for item.', a: 'All items share the line. Add a condition in code for the one that differs.' }
  ],
  questions: [
    { q: 'Which Vue versions does Feega support?', a: 'Vue 3 on Vite. The tagger uses the Vue 3 SFC compiler. Vue 2 is untested.' },
    { q: 'Does Feega support Nuxt?', a: 'Yes, Nuxt 4, when Feega starts the dev server. Select, text, style and structure edits are tested.' },
    { q: 'Where do CSS edits go?', a: 'Into the first style block of the component, as a rule for a class Feega adds. Scoped blocks stay scoped.' },
    { q: 'Does it need an account or AI credits?', a: 'No. Feega is free, open source and makes no model calls.' }
  ],
  sources: [
    FEEGA_SOURCE,
    OPEN_VSX,
    DOCS,
    { label: 'Vue: SFC CSS features (scoped, :deep)', href: 'https://vuejs.org/api/sfc-css-features.html' },
    { label: 'Vue: class and style bindings', href: 'https://vuejs.org/guide/essentials/class-and-style.html' },
    { label: 'create-vue on GitHub', href: 'https://github.com/vuejs/create-vue' }
  ],
  readNext: ['/for/sveltekit', '/for/tailwind', '/integrations/vscode', '/templates/vue', '/alternatives/visual-editor-for-your-codebase', '/download']
};
