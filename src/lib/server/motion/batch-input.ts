import { z } from 'zod';
import type { MotionDoc } from '$lib/motion/doc';
import type { RenderSettings } from '$lib/motion/export-formats';
import type { ComposeInput } from '$lib/motion/hyperframes/compose';
import { applyValues } from '$lib/motion/template/fields';
import { MAX_BATCH_ROWS } from '$lib/motion/template/batch';
import { renderRequest, type BatchRow } from './render-run';

const rowSchema = z.object({ name: z.string().min(1).max(80), values: z.record(z.string(), z.string().max(5000)) });
const rowsSchema = z.array(rowSchema).min(1).max(MAX_BATCH_ROWS);

export type RowValues = z.infer<typeof rowSchema>;
export type RowsVerdict = { ok: true; rows: RowValues[] } | { ok: false; error: string };
export type RequestsVerdict = { ok: true; rows: BatchRow[] } | { ok: false; error: string };

export function batchInput(raw: string | null): RowsVerdict {
  try {
    const parsed = rowsSchema.safeParse(JSON.parse(raw ?? ''));
    return parsed.success ? { ok: true, rows: parsed.data } : { ok: false, error: `invalid_rows: 1 to ${MAX_BATCH_ROWS} rows of { name, values }` };
  } catch {
    return { ok: false, error: 'invalid_rows' };
  }
}

export function rowRequests(head: { version: number; doc: MotionDoc }, rows: RowValues[], look: Omit<ComposeInput, 'doc'>, settings: RenderSettings): RequestsVerdict {
  const made: BatchRow[] = [];
  for (const [i, row] of rows.entries()) {
    const filled = applyValues(head.doc, row.values);
    if (!filled.ok) {
      return { ok: false, error: `row ${i + 1}: ${filled.error}` };
    }
    made.push({ name: row.name, req: renderRequest(head.version, { ...look, doc: filled.doc }, settings) });
  }
  return { ok: true, rows: made };
}
