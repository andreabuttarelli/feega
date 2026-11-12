import type { Guide } from './guide';
import { CONNECT_COMMAND, MCP_TOOLS, code, docsLink } from './shared';

export const CLAUDE_CODE_VIDEOS: Guide = {
  title: 'Can Claude Code make videos? Yes, with an MCP server',
  description: 'Claude Code does not render video itself. Connect the Feega MCP server and it edits a motion video on a canvas, then renders it to MP4.',
  heading: 'Can Claude Code make videos?',
  answer:
    'Yes. Claude Code can make videos by driving a tool that renders them. Connect the Feega MCP server and Claude Code edits a motion video on a canvas through typed operations, then renders it to MP4. Claude Code does not render pixels itself; it needs an editor or a code framework such as Remotion.',
  steps: [
    { name: 'Connect Feega to Claude Code', text: 'Run the claude mcp add command with the Feega MCP URL, then sign in to your Feega account when the browser opens.' },
    { name: 'Describe the video', text: 'Ask Claude Code for a video: the subject, the length and the look. It creates a frame and edits it with the edit tool.' },
    { name: 'Check a frame', text: 'Ask Claude Code to look at a snapshot of the video at a given second with the view tool, and fix what it sees.' },
    { name: 'Render to MP4', text: 'Ask for a render. Claude Code calls render_video, polls get_render, and gets the file URL when it is done.' }
  ],
  sections: [
    {
      heading: 'Two ways Claude Code makes a video',
      html: '<p><strong>Code.</strong> The agent writes a program that draws every frame, for example React components rendered by Remotion. Every fix is a code change.</p><p><strong>An editor.</strong> The agent sends typed edits to a video document on a canvas: add a clip, set a property, change an easing. A person can open the same file and edit it by hand. Feega works this way. See <a href="/compare/remotion">Feega vs Remotion</a>.</p>'
    },
    {
      heading: 'Connect Feega in one command',
      html: `${code(CONNECT_COMMAND)}<p>Feega is a remote MCP server at mcp.feega.app. Nothing is installed. Cursor and Codex connect to the same URL.</p>`
    },
    {
      heading: 'What Claude Code can call',
      html: `<p>The MCP server exposes these tools: ${MCP_TOOLS.map((t) => `<code>${t}</code>`).join(', ')}. <code>query</code>, <code>view</code> and <code>describe</code> are free reads. <code>edit</code> changes the canvas, and runs any other tool by name. <code>find_tools</code> searches the rest of the tools.</p>`
    },
    {
      heading: 'What comes out',
      html: '<p>MP4 (H.264 or H.265), ProRes, WebM with alpha, PNG sequence, GIF or APNG, and Lottie for a frame. Exports from an account without a subscription carry a small "Made with Feega" mark; paid plans export clean.</p>'
    }
  ],
  faq: [
    { q: 'Can Claude Code generate a video from a text prompt?', a: 'Claude Code itself only writes text and code. With Feega it can add AI video nodes (Seedance, Kling, Grok Imagine) or build a motion video from frames and keyframes, then render it.' },
    { q: 'Do I need to install anything?', a: 'No. Feega is a remote MCP server: run one claude mcp add command and sign in. To work without an account, run npx feega locally (Node 22).' },
    { q: 'Does it work with Cursor and Codex?', a: 'Yes. Both connect to the same MCP URL, https://mcp.feega.app/mcp.' },
    { q: 'Is Feega open source?', a: 'Yes, under the Apache-2.0 license. The code, the CLI and the MCP server are on GitHub.' }
  ],
  links: [docsLink('/integrations/mcp/', 'Feega MCP docs'), docsLink('/getting-started/first-video/', 'Your first video'), docsLink('/motion/export/', 'Export formats')],
  checked: '2026-11-08'
};
