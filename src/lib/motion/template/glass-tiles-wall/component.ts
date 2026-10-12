import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { GTW_MODEL } from './model';
import { GTW_VIEW } from './view';
import { GTW_CSS } from './style';

export const GTW_COMPONENT = 'GlassTilesWall';
export const GTW_VAR_PREFIX = 'gtw';

export const GTW_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

const TITLES = 'Night Index, Soft Power, Useful Noise, Tender Machines, Unfinished, Outer Office, Afterimage, New Rituals, Deep Surface, Free State, Near Future, Other Nature';
const CAPTIONS = 'An atlas for life after dark | A gentler language for bold ideas | Signals worth keeping | Tools that learned to listen | A story without an ending | Work designed around being human | What stays when the light goes | Small gestures for a changing world | Depth under every plane | Room to move | Tomorrow, slightly early | New ecologies for synthetic worlds';

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const GTW_PROPS: Record<string, PropSpec> = {
  media: text('Pictures and videos', '', { format: PropFormat.Media, maxLength: 2000 }),
  titles: text('Tile titles (comma separated)', TITLES, { maxLength: 600 }),
  captions: text('Tile captions (separated by |)', CAPTIONS, { maxLength: 1200 }),
  label: text('Small label on every tile', 'selected work', { maxLength: 40 }),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  fontWeight: number('Title weight', 500, 300, 800, 'Style', 100),
  tracking: number('Title tracking (em)', -0.045, -0.08, 0.05, 'Style', 0.005),
  background: colour('Background', '#04050b'),
  textColor: colour('Text colour', '#ffffff'),
  placeholderColor: colour('Empty tile colour', '#161a28'),
  tileSize: number('Tile width (share of the short side)', 0.34, 0.15, 0.8, 'Layout', 0.01),
  tileAspect: number('Tile aspect (width / height)', 1.42, 0.6, 2.2, 'Layout', 0.02),
  gap: number('Gap (share of the tile width)', 0.06, 0, 0.3, 'Layout', 0.01),
  roundness: number('Corner roundness (share of the tile width)', 0.13, 0, 0.3, 'Layout', 0.01),
  glass: number('Glass strength', 1, 0, 1.5, 'Style', 0.05),
  curve: number('Wall radius (share of the long side)', 0.9, 0.4, 3, 'Layout', 0.05),
  moves: number('Camera moves per loop', 3, 1, 8, 'Camera', 1),
  step: number('Tiles crossed per move', 2, 1, 4, 'Camera', 1),
  tilt: number('Camera tilt (degrees)', 4, 0, 15, 'Camera', 0.5),
  lift: number('Front tiles lift toward the camera', 1, 0, 3, 'Camera', 0.1),
  [VAR_PREFIX]: text('Runtime variable prefix', GTW_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function gtwComponent(): CustomComponent {
  return {
    source: { html: '', css: GTW_CSS.trim(), js: `${GTW_MODEL.trim()}\n\n${GTW_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: GTW_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
