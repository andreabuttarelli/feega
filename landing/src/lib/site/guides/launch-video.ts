import type { Guide } from './guide';
import { CONNECT_COMMAND, code, docsLink } from './shared';

export const LAUNCH_VIDEO: Guide = {
  title: 'How to make a launch video with Claude Code',
  description: 'Import your page, let Claude Code build the scenes on a Feega canvas, check a frame, and render the launch video to MP4. Steps and commands.',
  heading: 'How to make a launch video with Claude Code',
  answer:
    'Import your product page into Feega, connect Claude Code through the Feega MCP server, and ask it to build the scenes of the launch video. Check a frame, adjust, then render to MP4. The agent edits a video document you can also open and change by hand.',
  steps: [
    { name: 'Import your page', text: 'In Feega, open the insert menu, choose Import, then From URL, paste your product page address and press Import. The page becomes an editable frame.' },
    { name: 'Connect Claude Code', text: 'Run the claude mcp add command with the Feega MCP URL and sign in.' },
    { name: 'Brief the agent', text: 'Tell Claude Code the length, the scenes and the message. It builds the animation with typed edits.' },
    { name: 'Check a stretch', text: 'Render a short stretch, for example seconds 3 to 3.5, to check a frame before the whole video.' },
    { name: 'Render the video', text: 'Render the full video to MP4 and download the file.' }
  ],
  sections: [
    {
      heading: 'Connect Claude Code',
      html: code(CONNECT_COMMAND)
    },
    {
      heading: 'Ask for the scenes',
      html: '<p>Give Claude Code a brief, not code: "A 15 second launch video from the imported page. Title card, then the hero, then the pricing section, one change per scene, white titles." The agent changes the video through the <code>edit</code> tool. Several scenes can be joined into one video; see <a href="https://docs.feega.app/motion/scenes-into-one-video/">Scenes into one video</a>.</p>'
    },
    {
      heading: 'From the terminal instead',
      html: `${code('feega motion ask <nodeId> "Add a title card before the hero"\nfeega motion render <nodeId> --from 3 --to 3.5\nfeega motion render <nodeId>')}<p><code>motion ask</code> sends a request to the frame editor agent. <code>motion render</code> with <code>--from</code> and <code>--to</code> renders only that stretch through the same pipeline as the full export, so the pixels match.</p>`
    },
    {
      heading: 'Export',
      html: '<p>MP4 (H.264 or H.265), ProRes, WebM with alpha, PNG sequence, GIF or APNG. Resolution runs from 720p to 4K. A free account exports with a small "Made with Feega" mark.</p>'
    }
  ],
  faq: [
    { q: 'How long does a launch video take?', a: 'It depends on the brief and the number of changes. Feega does not publish a render time, so check a short stretch first, then render the whole video.' },
    { q: 'Can I keep editing by hand?', a: 'Yes. The agent and you edit the same document, so you can switch at any moment.' },
    { q: 'Can I add voice-over and music?', a: 'Yes. Feega generates text to speech, music and sound effects. See the audio docs.' },
    { q: 'Do I need Remotion?', a: 'No. Feega does not need you to write React code. See Feega vs Remotion for the difference.' }
  ],
  links: [docsLink('/integrations/import-from-url/', 'Import from URL'), docsLink('/integrations/cli/', 'CLI commands'), docsLink('/audio/motion-voiceover-music/', 'Voice-over and music'), docsLink('/motion/export/', 'Export')],
  checked: '2026-11-08'
};
