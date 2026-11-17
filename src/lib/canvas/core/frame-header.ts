import type { Component } from 'svelte';
import ComponentIcon from '@lucide/svelte/icons/component';
import MonitorSmartphone from '@lucide/svelte/icons/monitor-smartphone';
import Play from '@lucide/svelte/icons/play';
import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
import FileX from '@lucide/svelte/icons/file-x';
import Lock from '@lucide/svelte/icons/lock';
import CircleArrowDown from '@lucide/svelte/icons/circle-arrow-down';
import Pencil from '@lucide/svelte/icons/pencil';
import GitPullRequest from '@lucide/svelte/icons/git-pull-request';
import CircleCheck from '@lucide/svelte/icons/circle-check';
import { shownAtRest, type CameraMotion } from './camera-motion';

export enum FrameBadge {
  Play = 'play',
  SourceConflict = 'source-conflict',
  SourceOrphan = 'source-orphan',
  SourceReadOnly = 'source-read-only',
  SourceUpstream = 'source-upstream',
  SourceModified = 'source-modified',
  SourceInPr = 'source-in-pr',
  SourceInSync = 'source-in-sync',
  Component = 'component',
  Breakpoint = 'breakpoint'
}

export enum SourceSync {
  Conflict = 'conflict',
  Orphan = 'orphan',
  ReadOnly = 'read-only',
  Upstream = 'upstream',
  Modified = 'modified',
  InPr = 'in-pr',
  InSync = 'in-sync'
}

export enum HeaderAction {
  Select = 'select',
  Play = 'play',
  Source = 'source'
}

export type FrameFacts = { breakpoints: boolean; component: boolean; source: readonly SourceSync[] };

export type HeaderFlags = { sourceSync: boolean };

export const HEADER_FLAGS: HeaderFlags = { sourceSync: true };

type HeaderRow = { badge: FrameBadge; icon: Component; tooltip: string; action: HeaderAction; shows: (f: FrameFacts) => boolean; source?: SourceSync };

const sourceRow = (badge: FrameBadge, source: SourceSync, icon: Component, tooltip: string): HeaderRow => ({ badge, icon, tooltip, action: HeaderAction.Source, shows: (f) => f.source.includes(source), source });

export const frameHeaderIcons: readonly HeaderRow[] = [
  { badge: FrameBadge.Play, icon: Play, tooltip: 'Play', action: HeaderAction.Play, shows: () => true },
  sourceRow(FrameBadge.SourceConflict, SourceSync.Conflict, TriangleAlert, 'Conflict with GitHub'),
  sourceRow(FrameBadge.SourceOrphan, SourceSync.Orphan, FileX, 'Source file gone'),
  sourceRow(FrameBadge.SourceReadOnly, SourceSync.ReadOnly, Lock, 'GitHub access lost, read-only'),
  sourceRow(FrameBadge.SourceUpstream, SourceSync.Upstream, CircleArrowDown, 'Newer on GitHub'),
  sourceRow(FrameBadge.SourceModified, SourceSync.Modified, Pencil, 'Modified since last sync'),
  sourceRow(FrameBadge.SourceInPr, SourceSync.InPr, GitPullRequest, 'In a pull request'),
  sourceRow(FrameBadge.SourceInSync, SourceSync.InSync, CircleCheck, 'In sync with GitHub'),
  { badge: FrameBadge.Component, icon: ComponentIcon, tooltip: 'Component set', action: HeaderAction.Select, shows: (f) => f.component },
  { badge: FrameBadge.Breakpoint, icon: MonitorSmartphone, tooltip: 'Breakpoints', action: HeaderAction.Select, shows: (f) => f.breakpoints }
];

export const headerRow = (badge: FrameBadge): HeaderRow => frameHeaderIcons.find((r) => r.badge === badge)!;

const flagged = (r: HeaderRow, flags: HeaderFlags) => r.source === undefined || flags.sourceSync;

export function headerBadges(f: FrameFacts, flags: HeaderFlags = HEADER_FLAGS): FrameBadge[] {
  const shown = frameHeaderIcons.filter((r) => flagged(r, flags) && r.shows(f));
  const topSource = shown.find((r) => r.source !== undefined);
  return shown.filter((r) => r.source === undefined || r === topSource).map((r) => r.badge);
}

export type HeaderHit = { id: string; key: FrameBadge; x: number; y: number; w: number; h: number };

export const headerHits = (hits: HeaderHit[], motion: CameraMotion): HeaderHit[] => shownAtRest(hits, motion) ?? [];
