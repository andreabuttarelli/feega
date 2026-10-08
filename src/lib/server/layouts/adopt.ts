import type { Db } from '$lib/server/db/client';
import type { MotionClip, MotionDoc } from '$lib/motion/doc';
import { freeName } from '$lib/motion/shaders/model';
import { CUSTOM_LAYOUT } from '$lib/canvas/composition/index';
import type { LayoutSpec } from '$lib/canvas/composition/spec';
import { Outcome } from '$lib/server/repos/effects';
import { listLayouts, writeLayout } from '$lib/server/repos/layouts';
import type { WorkspaceAuthor } from '$lib/server/effects/adopt';

type CustomProps = { layout: string; layoutRef: string; layoutSpec: LayoutSpec | null };

const FALLBACK_NAME = 'layout';

const customOf = (clip: MotionClip): CustomProps | null => {
  const props = clip.props as Partial<CustomProps>;
  return clip.component === 'Composition' && props.layout === CUSTOM_LAYOUT && props.layoutSpec ? (props as CustomProps) : null;
};

function mapClips(doc: MotionDoc, fn: (clip: MotionClip) => MotionClip): MotionDoc {
  const tracks = <T extends { clips: unknown[] }>(list: T[]) => list.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map(fn) }));
  return { ...doc, tracks: tracks(doc.tracks), comps: Object.fromEntries(Object.entries(doc.comps).map(([id, c]) => [id, { ...c, tracks: tracks(c.tracks) }])) } as MotionDoc;
}

export async function adoptLayouts(db: Db, scope: { orgId: string; author: WorkspaceAuthor }, doc: MotionDoc): Promise<MotionDoc> {
  const clips = [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips as MotionClip[]);
  const used = new Map(clips.flatMap((clip): [string, LayoutSpec][] => {
    const custom = customOf(clip);
    return custom?.layoutSpec ? [[custom.layoutRef, custom.layoutSpec]] : [];
  }));
  if (!used.size) {
    return doc;
  }

  const existing = await listLayouts(db, scope.orgId);
  if (!existing) {
    return doc;
  }

  const taken = new Set(existing.map((l) => l.name));
  const refs = new Map<string, { id: string; name: string }>();
  for (const [ref, spec] of used) {
    const name = freeName(spec.name ?? FALLBACK_NAME, taken);
    const written = await writeLayout(db, scope.orgId, scope.author, { name, spec: { ...spec, name } });
    if (written.outcome === Outcome.Ok) {
      taken.add(name);
      refs.set(ref, { id: written.layout.id, name });
    }
  }

  return mapClips(doc, (clip) => {
    const custom = customOf(clip);
    const adopted = custom ? refs.get(custom.layoutRef) : undefined;
    return adopted && custom ? { ...clip, props: { ...clip.props, layoutRef: adopted.id, layoutSpec: { ...custom.layoutSpec, name: adopted.name } } } : clip;
  });
}
