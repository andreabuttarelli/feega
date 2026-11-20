export enum UiIcon {
  SidesAll = 'sides-all',
  SidesAxis = 'sides-axis',
  SidesEach = 'sides-each',
  CornersAll = 'corners-all',
  CornersEach = 'corners-each',
  Padding = 'padding',
  Margin = 'margin',
  Radius = 'radius'
}

export const UI_ICON_SVG: Record<UiIcon, string> = {
  [UiIcon.SidesAll]: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/>',
  [UiIcon.SidesAxis]: '<rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke-dasharray="1.5 1.5"/><line x1="2.5" y1="5" x2="2.5" y2="11"/><line x1="13.5" y1="5" x2="13.5" y2="11"/>',
  [UiIcon.SidesEach]: '<rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke-dasharray="1.5 1.5"/><line x1="5" y1="2.5" x2="11" y2="2.5"/><line x1="13.5" y1="5" x2="13.5" y2="11"/><line x1="5" y1="13.5" x2="11" y2="13.5"/><line x1="2.5" y1="5" x2="2.5" y2="11"/>',
  [UiIcon.CornersAll]: '<rect x="2.5" y="2.5" width="11" height="11" rx="4"/>',
  [UiIcon.CornersEach]: '<path d="M2.5 6.5V5a2.5 2.5 0 0 1 2.5-2.5h1.5M9.5 2.5H11a2.5 2.5 0 0 1 2.5 2.5v1.5M13.5 9.5V11a2.5 2.5 0 0 1-2.5 2.5H9.5M6.5 13.5H5A2.5 2.5 0 0 1 2.5 11V9.5"/>',
  [UiIcon.Padding]: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><rect x="5.5" y="5.5" width="5" height="5" rx="1" stroke-dasharray="1.2 1.2"/>',
  [UiIcon.Margin]: '<rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke-dasharray="1.2 1.2"/><rect x="5.5" y="5.5" width="5" height="5" rx="1"/>',
  [UiIcon.Radius]: '<path d="M3 13V8a5 5 0 0 1 5-5h5"/>'
};
