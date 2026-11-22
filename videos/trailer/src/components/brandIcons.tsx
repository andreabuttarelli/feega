import { siCursor, siX } from "simple-icons";

export type BrandMark = { path: string; viewBox: string };

const SIMPLE_ICONS_BOX = "0 0 24 24";

const VSCODE_FROM_SIMPLE_ICONS_7_21_0 =
  "M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z";

const GROK_FROM_LOBEHUB_ICONS_1_105_0 =
  "M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815";

const FEEGA_LOBE = "M61.87 142.25A57 57 0 1 1 136.13 142.25A69.5 69.5 0 0 0 61.87 142.25Z";

export const FEEGA_ORANGE = "#FF5100";
export const VSCODE_BLUE = "#007ACC";

export const MARKS = {
  x: { path: siX.path, viewBox: SIMPLE_ICONS_BOX },
  cursor: { path: siCursor.path, viewBox: SIMPLE_ICONS_BOX },
  vscode: { path: VSCODE_FROM_SIMPLE_ICONS_7_21_0, viewBox: SIMPLE_ICONS_BOX },
  grok: { path: GROK_FROM_LOBEHUB_ICONS_1_105_0, viewBox: SIMPLE_ICONS_BOX },
} satisfies Record<string, BrandMark>;

export const FeegaMark = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="36 36 228 228" fill={FEEGA_ORANGE}>
    {[0, 90, 180, 270].map((deg) => (
      <path key={deg} d={FEEGA_LOBE} transform={`rotate(${deg} 150 150)`} />
    ))}
  </svg>
);

export const Mark = ({ mark, size, color }: { mark: BrandMark; size: number; color: string }) => (
  <svg width={size} height={size} viewBox={mark.viewBox} fill={color} fillRule="evenodd">
    <path d={mark.path} />
  </svg>
);
