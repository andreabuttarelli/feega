import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import type { BrandTokens } from '../brand';
import { clipLook } from '../design';
import type { MotionClip, MotionDoc } from '../doc';
import { boxOf } from '../layout';
import { KIT, Kit, type PropsOf } from './kit';
import { INK } from './theme';

export type CompositionProps = {
  doc: MotionDoc;
  tokens: BrandTokens;
  assets: Record<string, string>;
  selected?: string[];
};

const ClipFrame: React.FC<{ clip: MotionClip; children: React.ReactNode }> = ({ clip, children }) => {
  const frame = useCurrentFrame();
  const look = clipLook(frame, clip.durationInFrames, clip.transitionIn, clip.transitionOut);
  return (
    <AbsoluteFill style={{ opacity: look.opacity, transform: look.transform || undefined, clipPath: look.clipPath || undefined, filter: look.filter || undefined }}>
      {children}
    </AbsoluteFill>
  );
};

const Highlight: React.FC<{ clip: MotionClip }> = ({ clip }) => {
  const { width, height } = useVideoConfig();
  const p = clip.props as { x?: number; y?: number; width?: number; height?: number };
  const box = boxOf({ x: p.x ?? 0.5, y: p.y ?? 0.5, width: p.width ?? 1, height: p.height ?? 1 }, { width, height });
  return <div style={{ position: 'absolute', ...box, outline: `${Math.max(2, width / 480)}px solid ${INK.select}`, pointerEvents: 'none' }} />;
};

function ClipView({ clip }: { clip: MotionClip }) {
  const Component = KIT[clip.component] as React.FC<{ p: PropsOf<typeof clip.component> }>;
  return <Component p={clip.props as PropsOf<typeof clip.component>} />;
}

export function renderDoc({ doc, tokens, assets, selected = [] }: CompositionProps): React.ReactElement {
  const assetUrl = (id: string | null) => (id ? (assets[id] ?? null) : null);
  const bottomFirst = [...doc.tracks].reverse();

  return (
    <AbsoluteFill style={{ background: tokens.colors['brand.background'] }}>
      {bottomFirst.flatMap((track) =>
        (track.clips as MotionClip[]).map((clip) => (
          <Sequence key={clip.id} from={clip.from} durationInFrames={clip.durationInFrames} name={`${clip.component} ${clip.id}`} layout="none">
            <Kit.Provider value={{ tokens, assetUrl, trimStart: clip.trimStart }}>
              <ClipFrame clip={clip}>
                <ClipView clip={clip} />
              </ClipFrame>
              {selected.includes(clip.id) ? <Highlight clip={clip} /> : null}
            </Kit.Provider>
          </Sequence>
        ))
      )}
    </AbsoluteFill>
  );
}

export const MotionComposition: React.FC<CompositionProps> = (props) => renderDoc(props);
