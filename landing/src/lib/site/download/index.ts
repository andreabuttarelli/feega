import { FEEGA_VERSION, NODE_REQUIREMENT, NPX_COMMAND, VSCODE_REQUIREMENT } from '../links';

export const DOWNLOAD_PAGE = {
  heading: 'download feega',
  lead: 'design in your codebase. free, no account.',
  version: `version ${FEEGA_VERSION}`,
  editorsHeading: 'install in your editor',
  terminal: {
    heading: 'from the terminal',
    command: NPX_COMMAND,
    line: 'opens your project in the editor and installs the extension if it is missing.',
    requirement: NODE_REQUIREMENT
  },
  requirements: {
    heading: 'requirements',
    items: [VSCODE_REQUIREMENT, 'React, Next.js, SvelteKit or Vue', 'Tailwind or plain CSS', 'macOS, Windows or Linux']
  },
  privacy: 'runs locally. no account. sends nothing.'
} as const;
