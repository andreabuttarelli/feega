import type { Db } from '$lib/server/db/client';
import { createProject } from '$lib/server/repos/projects';
import { createCanvas } from '$lib/server/repos/canvas';
import { ProjectMode } from '$lib/project-mode';
import { NsfwLock } from '$lib/nsfw-access';
import { ageStore, configuredVerifier, nsfwLockFor } from './nsfw-server';
import { verifyAge } from './age-verification';

const DEFAULT_NAME = 'NSFW project';
const FIRST_CANVAS = 'Canvas';
const SLUG_BYTES = 4;

export type WorkspaceOutcome = { ok: true; projectId: string; canvasId: string } | { ok: false; error: string };

export type VerifyOutcome = { ok: true } | { ok: false; error: string };

function slugFor(): string {
  const suffix = [...crypto.getRandomValues(new Uint8Array(SLUG_BYTES))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `nsfw-${suffix}`;
}

export async function openNsfwProject(db: Db, input: { orgId: string; userId: string; name: string }): Promise<WorkspaceOutcome> {
  const lock = await nsfwLockFor(db, input);
  if (lock !== NsfwLock.Open) {
    return { ok: false, error: lock };
  }

  const project = await createProject(db, { orgId: input.orgId, name: input.name.trim() || DEFAULT_NAME, slug: slugFor(), mode: ProjectMode.Nsfw });
  const canvas = await createCanvas(db, { orgId: input.orgId, projectId: project.id, name: FIRST_CANVAS });
  return { ok: true, projectId: project.id, canvasId: canvas.id };
}

export async function verifyUserAge(db: Db, input: { orgId: string; userId: string }): Promise<VerifyOutcome> {
  const verifier = configuredVerifier();
  const lock = await nsfwLockFor(db, input);
  if (lock === NsfwLock.Open) {
    return { ok: true };
  }
  if (!verifier || lock !== NsfwLock.AgeUnverified) {
    return { ok: false, error: lock };
  }
  return verifyAge(verifier, ageStore(db), input.userId);
}
