import { compOf, findClip, type MotionClip, type MotionDoc } from '$lib/motion/doc';
import { MAX_COMP_DEPTH, SEPARATOR, mergeView, viewOf, type CompPath } from '$lib/motion/precomp';
import { apply2d, invert2d, worldAt } from '$lib/motion/parent';
import type { Pt } from '$lib/motion/scene-select';
import { Reach, clickTarget } from './frame-select';

export type Scope = { path: CompPath; prefix: string; hosts: string[]; parents: string[] };

const ROOT: Scope = { path: [], prefix: '', hosts: [], parents: [] };

const clipsOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]);

function hostOf(view: MotionDoc, rest: string): MotionClip | null {
  return clipsOf(view).find((c) => compOf(c) && rest.startsWith(`${c.id}${SEPARATOR}`)) ?? null;
}

export function scopeOf(doc: MotionDoc, sceneId: string): { scope: Scope; id: string } | null {
  let scope = ROOT;
  for (let depth = 0; depth <= MAX_COMP_DEPTH; depth++) {
    const view = viewOf(doc, scope.path);
    const rest = sceneId.slice(scope.prefix.length);
    if (findClip(view, rest)) {
      return { scope, id: rest };
    }
    const host = hostOf(view, rest);
    if (!host) {
      return null;
    }
    const [loop] = rest.slice(host.id.length + SEPARATOR.length).split(SEPARATOR);
    scope = { path: [...scope.path, compOf(host)!], prefix: `${scope.prefix}${host.id}${SEPARATOR}${loop}${SEPARATOR}`, hosts: [...scope.hosts, host.id], parents: [...scope.parents, `${scope.prefix}${host.id}`] };
  }
  return null;
}

export type Scoped = { view: MotionDoc; ids: string[]; frame: number; merge: (view: MotionDoc) => MotionDoc; scene: (ids: readonly string[]) => string[]; toView: (p: Pt) => Pt };

function descend(doc: MotionDoc, scope: Scope, frame: number) {
  let at = frame;
  const worlds = scope.hosts.map((hostId, depth) => {
    const parent = viewOf(doc, scope.path.slice(0, depth));
    const host = findClip(parent, hostId)!.clip;
    const world = worldAt(parent, hostId, at, { width: parent.width, height: parent.height });
    at = at - host.from + host.trimStart;
    return world;
  });
  return { frame: at, toView: (p: Pt) => worlds.reduce<Pt>((q, w) => apply2d(invert2d(w), q) as Pt, p) };
}

export function scoped(doc: MotionDoc, sceneIds: readonly string[], frame: number): Scoped | null {
  const read = sceneIds.map((id) => scopeOf(doc, id));
  const scope = read[0]?.scope;
  if (!scope || read.some((r) => r?.scope.prefix !== scope.prefix)) {
    return null;
  }
  const inside = descend(doc, scope, frame);
  return {
    view: viewOf(doc, scope.path),
    ids: read.map((r) => r!.id),
    frame: inside.frame,
    merge: (view) => mergeView(doc, scope.path, view),
    scene: (ids) => ids.map((id) => `${scope.prefix}${id}`),
    toView: inside.toView
  };
}

const prefixOf = (doc: MotionDoc, id: string) => scopeOf(doc, id)?.scope.prefix;

export function chainTarget(doc: MotionDoc, chain: readonly string[], picks: readonly string[], reach: Reach): string | null {
  if (!chain.length) {
    return null;
  }
  if (reach === Reach.Deep) {
    return chain[chain.length - 1];
  }
  const level = picks.length ? prefixOf(doc, picks[0]) : undefined;
  const sibling = level ? chain.find((id) => prefixOf(doc, id) === level) : undefined;
  if (sibling) {
    return sibling;
  }
  const top = chain.filter((id) => findClip(doc, id)).at(-1);
  return top ? clickTarget(doc, top, picks, Reach.Top) : null;
}

export function enteredFrom(chain: readonly string[], picks: readonly string[]): string | null {
  const at = picks.length === 1 ? chain.indexOf(picks[0]) : -1;
  return at >= 0 ? (chain[at + 1] ?? null) : null;
}

export const parentPick = (doc: MotionDoc, sceneId: string): string | null => scopeOf(doc, sceneId)?.scope.parents.at(-1) ?? null;
