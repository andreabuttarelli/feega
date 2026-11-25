import { DESKTOP_DMGS, DESKTOP_INSTALL_COMMAND, DESKTOP_LINUX, DESKTOP_LINUX_FILE, DESKTOP_WINDOWS, FEEGA_VERSION, NODE_REQUIREMENT, NPX_COMMAND, VSCODE_REQUIREMENT } from '../links';

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
    lead: 'a standalone app for macOS, Windows and Linux. one tab per folder, no editor needed. it updates itself.',
    terminalLabel: 'or install from the terminal',
    command: DESKTOP_INSTALL_COMMAND,
    terminalNote: 'macOS and Linux. downloads the app; on macOS it also opens it.',
    downloadsLabel: 'download for your system',
    macNote: 'signed and notarized by Apple.',
    windowsNote: 'Windows may show "Windows protected your PC": click More info, then Run anyway.',
    linuxNote: 'make it executable, then run it:',
    linuxCommand: `chmod +x ${DESKTOP_LINUX_FILE} && ./${DESKTOP_LINUX_FILE}`,
    mac: { name: 'macOS', files: DESKTOP_DMGS.map((d) => ({ label: d.arch, href: d.href, target: `dmg_${d.arch.toLowerCase().replace(' ', '_')}` })) },
    windows: { name: 'Windows', badge: 'beta', files: [{ label: 'installer (.exe)', href: DESKTOP_WINDOWS.href, target: 'windows_exe' }] },
    linux: { name: 'Linux', files: [{ label: 'AppImage', href: DESKTOP_LINUX.href, target: 'linux_appimage' }] }
  },
  requirements: {
    heading: 'requirements',
    items: [VSCODE_REQUIREMENT, 'React, Next.js, SvelteKit, Vue, Nuxt, React Router, Astro or Vite', 'Tailwind or plain CSS', 'macOS, Windows or Linux']
  },
  privacy: 'runs locally. no account. sends nothing.'
} as const;
