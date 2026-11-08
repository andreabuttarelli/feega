import type { Guide } from './guide';
import { code, docsLink } from './shared';

export const ANIMATE_UI: Guide = {
  title: 'How to animate a UI with an AI agent',
  description: 'Bring a UI into Feega from a URL or Figma, then let an AI agent set keyframes and easings on the timeline. Export to MP4, GIF or Lottie.',
  heading: 'How to animate a UI with an AI agent',
  answer:
    'Bring the UI into Feega as an editable frame, from a web page address or by pasting from Figma. Connect an agent such as Claude Code through MCP, ask for the motion, and it sets keyframes and easings on the timeline. Export the result as MP4, GIF or Lottie.',
  steps: [
    { name: 'Bring the UI in', text: 'Import a public page with Insert, Import, From URL, or paste layers from Figma. Text stays text and layers stay editable.' },
    { name: 'Switch to Animate', text: 'Under every frame a Design and Animate switch sets whether a change moves the whole animation or is keyed at the playhead.' },
    { name: 'Ask the agent for the motion', text: 'Describe the movement in words. The agent sets keyframes and easings with typed edits to the frame.' },
    { name: 'Refine on the timeline', text: 'Play with Space and adjust keyframes by hand. Animate to creates keyframes from where a property is now to where you type it should end up.' },
    { name: 'Export', text: 'Export MP4, GIF or APNG, or Lottie and dotLottie for a frame up to 30 seconds.' }
  ],
  sections: [
    {
      heading: 'What an imported UI becomes',
      html: '<p>Imports are not screenshots. Text stays text in the page fonts, backgrounds and shadows become fills and effects, and interactive parts such as tabs and accordions become components with variants you can animate between.</p>'
    },
    {
      heading: 'Ask for motion in plain words',
      html: `${code('Animate the hero: the headline slides up in 0.6 s with an expo ease out,\nthen the button fades in. Hold for one second.')}<p>Easing, timing and keyframes are properties of the video document, so the agent changes them directly and you can see each edit on the canvas.</p>`
    },
    {
      heading: 'Lottie for apps',
      html: '<p>A frame exports as Lottie or dotLottie with shapes, gradients, masks and text as shapes. Anything that cannot be written is listed in the export dialog.</p>'
    }
  ],
  faq: [
    { q: 'Which agents can animate a UI in Feega?', a: 'Claude Code, Codex and Cursor connect through the MCP server at https://mcp.feega.app/mcp. The CLI and REST API work too.' },
    { q: 'Can I animate a Figma design?', a: 'Yes. Paste from Figma and the layers stay editable on the canvas, ready for keyframes.' },
    { q: 'Does it export interactive prototypes?', a: 'Feega has click-through prototype links and a prototype player. It does not have an interactive runtime with state machines.' },
    { q: 'Is the animation code?', a: 'No. It is a video document of tracks, clips and properties. Code export exists as a separate feature for frames.' }
  ],
  links: [docsLink('/integrations/import-from-url/', 'Import from URL'), docsLink('/motion/keyframes-and-easing/', 'Keyframes and easing'), docsLink('/motion/timeline/', 'Timeline'), docsLink('/motion/export/', 'Export')],
  checked: '2026-11-08'
};
