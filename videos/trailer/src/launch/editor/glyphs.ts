export const GLYPH = {
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  panelLeft: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
  panelRight: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  reload: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  full: '<path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/>',
  desktop: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  tablet: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M12 18h.01"/>',
  phone: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
  alignStart: '<path d="M21 5H3"/><path d="M15 12H3"/><path d="M17 19H3"/>',
  alignCenter: '<path d="M21 5H3"/><path d="M17 12H7"/><path d="M19 19H5"/>',
  alignEnd: '<path d="M21 5H3"/><path d="M21 12H9"/><path d="M21 19H7"/>',
  alignJustify: '<path d="M3 5h18"/><path d="M3 12h18"/><path d="M3 19h18"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  design: '<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  theme: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  minus: '<path d="M5 12h14"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
} as const;

export type Glyph = keyof typeof GLYPH;

export const LAYER = {
  head: '<path d="M5.25 4 1.75 8l3.5 4"/><path d="m10.75 4 3.5 4-3.5 4"/><line x1="9.25" y1="2.75" x2="6.75" y2="13.25"/>',
  title: '<line x1="4" y1="2.75" x2="4" y2="13.25"/><line x1="12" y1="2.75" x2="12" y2="13.25"/><line x1="4" y1="8" x2="12" y2="8"/>',
  meta: '<path d="M6 5 3 8l3 3M10 5l3 3-3 3"/>',
  block: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/>',
  flexRow: '<rect x="2.25" y="2.75" width="4.5" height="10.5" rx="2"/><rect x="9.25" y="2.75" width="4.5" height="10.5" rx="2"/>',
  flexColumn: '<g transform="rotate(90 8 8)"><rect x="2.25" y="2.75" width="4.5" height="10.5" rx="2"/><rect x="9.25" y="2.75" width="4.5" height="10.5" rx="2"/></g>',
  grid: '<rect x="2.25" y="2.25" width="4.25" height="4.25" rx="1"/><rect x="9.5" y="2.25" width="4.25" height="4.25" rx="1"/><rect x="2.25" y="9.5" width="4.25" height="4.25" rx="1"/><rect x="9.5" y="9.5" width="4.25" height="4.25" rx="1"/>',
  header: '<rect x="2.25" y="2.25" width="11.5" height="4" rx="1"/><path d="M2.25 8.5v3.25c0 1.105.895 2 2 2h7.5c1.105 0 2-.895 2-2V8.5"/>',
  footer: '<path d="M2.25 7.5V4.25c0-1.105.895-2 2-2h7.5c1.105 0 2 .895 2 2V7.5"/><rect x="2.25" y="9.75" width="11.5" height="4" rx="1"/>',
  nav: '<line x1="2.75" y1="3.75" x2="13.25" y2="3.75"/><line x1="2.75" y1="8" x2="13.25" y2="8"/><line x1="2.75" y1="12.25" x2="13.25" y2="12.25"/>',
  h1: '<line x1="2.25" y1="3" x2="2.25" y2="13"/><line x1="7.25" y1="3" x2="7.25" y2="13"/><line x1="2.25" y1="8" x2="7.25" y2="8"/><path d="M10.5 9.75 12.5 8.25 12.5 13"/>',
  text: '<path d="M8.25 2.25H6.5a2.125 2.125 0 0 0 0 4.25h1.75"/><line x1="8.25" y1="2.25" x2="8.25" y2="9.25"/><line x1="10.75" y1="2.25" x2="10.75" y2="9.25"/><line x1="8.25" y1="2.25" x2="12.25" y2="2.25"/>',
  link: '<g transform="rotate(-45 8 8)"><path d="M7 5.75H4.75a2.25 2.25 0 0 0 0 4.5H7"/><path d="M9 5.75h2.25a2.25 2.25 0 0 1 0 4.5H9"/><line x1="5.75" y1="8" x2="10.25" y2="8"/></g>',
  button: '<rect x="1.75" y="4.5" width="12.5" height="7" rx="2"/><line x1="9.75" y1="4.5" x2="9.75" y2="11.5"/><line x1="4" y1="8" x2="7.5" y2="8"/><path d="M11.25 7.75 12 8.5l.75-.75"/>',
  repeat: '<path d="M2.75 7.5v-1A2.25 2.25 0 0 1 5 4.25h8.25"/><path d="m11 2 2.25 2.25L11 6.5"/><path d="M13.25 8.5v1A2.25 2.25 0 0 1 11 11.75H2.75"/><path d="m5 9.5-2.25 2.25L5 14"/>'
} as const;

export type LayerGlyph = keyof typeof LAYER;

export const MARK =
  '<circle cx="5" cy="5" r="3.2" fill="#ff5a1f"/><circle cx="11" cy="5" r="3.2" fill="#ff8a3d"/><circle cx="5" cy="11" r="3.2" fill="#ff8a3d"/><circle cx="11" cy="11" r="3.2" fill="#ff5a1f"/>';
