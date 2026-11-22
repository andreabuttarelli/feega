import { DESKTOP_INSTALL_COMMAND, FEEGA_VERSION, NODE_REQUIREMENT, NPX_COMMAND, VSCODE_REQUIREMENT } from '../links';

export const DOWNLOAD_PAGE = {
  heading: 'download feega',
  lead: 'design in your codebase. on macOS, Windows and Linux. free, no account.',
  version: `version ${FEEGA_VERSION}`,
  editorsHeading: 'install in your editor',
  terminal: {
    heading: 'from the terminal',
    command: NPX_COMMAND,
    line: 'opens your project in the editor and installs the extension if it is missing.',
    requirement: NODE_REQUIREMENT
  },
  desktop: {
    heading: 'desktop app (beta)',
    lead: 'a standalone app for macOS. one tab per folder, no editor needed.',
    terminalLabel: 'install from the terminal',
    command: DESKTOP_INSTALL_COMMAND,
    terminalNote: 'downloads the app and opens it. macOS does not block it.',
    dmgLabel: 'or download the dmg',
    dmgNote: 'macOS blocks the dmg: open system settings, privacy & security, then press open anyway.'
  },
  requirements: {
    heading: 'requirements',
    items: [VSCODE_REQUIREMENT, 'React, Next.js, SvelteKit, Vue, Nuxt, React Router, Astro or Vite', 'Tailwind or plain CSS', 'macOS, Windows or Linux']
  },
  privacy: 'runs locally. no account. sends nothing.'
} as const;
