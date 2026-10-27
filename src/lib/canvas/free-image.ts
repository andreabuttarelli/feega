import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { tileNode } from './connect-rules';
import type { ConnectorType } from './connectors';
import type { CanvasNode } from './graph';
import { portsOf } from './node-ports';

const IMAGE_COMPONENT = 'Image';
const ELEMENT = 'element';

export function freeImageAssetId(doc: MotionDoc | null): string | null {
  const clips = doc?.tracks.flatMap((track) => track.clips) ?? [];
  const only = clips.length === 1 ? clips[0] : null;
  const assetId = only?.component === IMAGE_COMPONENT ? only.props.assetId : null;

  return typeof assetId === 'string' && assetId ? assetId : null;
}

type SourceTile = { id: string; kind?: string; connectable?: boolean; connectors?: ConnectorType[]; output?: ConnectorType | null; node?: CanvasNode };

const NO_PORTS = { modelPorts: () => [], listPorts: () => [], itemPort: () => 'images' as const, mediaKind: () => 'image' as const };

export function imageSourceTile<T extends SourceTile>(tile: T, doc: MotionDoc | null): T {
  if (tile.kind !== ELEMENT) {
    return tile;
  }

  const { output } = portsOf(ELEMENT, { ...NO_PORTS, holdsImage: () => !!freeImageAssetId(doc) });
  if (!output) {
    return tile;
  }

  return { ...tile, connectable: true, connectors: [], output, node: tileNode({ id: tile.id, medium: ELEMENT }) };
}
