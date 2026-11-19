import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-19',
  title: 'Feega Inspect for VS Code, Cursor and Windsurf',
  items: [
    'Click an element of your running app inside your editor and change its spacing, type, colour, size, radius, layout or shadow.',
    'Each change is written to your source as a Tailwind class or your own token, or as plain CSS in projects without Tailwind, and Cmd/Ctrl+Z restores the file.',
    'Double-click a text to rewrite it in place.',
    'Switch between Design and Navigate, move through your routes, and preview at desktop, tablet or phone width.',
    'Inspect reuses a dev server you already started only when it belongs to the open project.',
    '"This element" now changes only the selected element, even when it shares a class with others.',
    'Open in editor jumps to the exact line, and text that comes from data points at where the data is defined.',
    'Headings and paragraphs that wrap styled spans now show Typography.',
    'Drag a number label to scrub: the page updates live and the change is saved once when you let go.',
    'The selection outline follows the element as it resizes, scrolls or reloads.',
    'Showing a hidden element removes exactly what hiding added.',
    'Icons inside links and buttons can be selected and resized on their own.',
    'Gradient stops and shadows use the same colour picker and palette as fills.',
    'Pick a device from icons or the full preset list, rotate tablets, and drag the frame edges to any width.',
    'Right-click a folder in the Explorer and choose Design this folder with Feega, including apps inside a monorepo.',
    'Design this page opens the preview on the route that file renders.',
    'Edits update the page in place; if it ever reloads, your scroll and selection come back.',
    'Select the page itself to set its background, font and spacing in your global stylesheet.'
  ]
} satisfies ChangelogEntry;
