import type { TemplateEntry } from './library';
import { DIAGONAL_PILLS_COMPONENT } from './diagonal-pills-poster/component';
import { DIAGONAL_PILLS_POSTER_TEMPLATE, DIAGONAL_PILLS_TEMPLATE_ID } from './diagonal-pills-poster/template';
import { BLUE_TRAILS_COMPONENT } from './blue-trails-poster/component';
import { BLUE_TRAILS_POSTER_TEMPLATE, BLUE_TRAILS_TEMPLATE_ID } from './blue-trails-poster/template';
import { STEP_BLOBS_COMPONENT } from './step-blobs-poster/component';
import { STEP_BLOBS_POSTER_TEMPLATE, STEP_BLOBS_TEMPLATE_ID } from './step-blobs-poster/template';
import { METABALL_LISTING_COMPONENT } from './metaball-listing-poster/component';
import { METABALL_LISTING_POSTER_TEMPLATE, METABALL_LISTING_TEMPLATE_ID } from './metaball-listing-poster/template';
import { PIXEL_BURST_COMPONENT } from './pixel-burst-poster/component';
import { PIXEL_BURST_POSTER_TEMPLATE, PIXEL_BURST_TEMPLATE_ID } from './pixel-burst-poster/template';
import { ACID_STROKES_COMPONENT } from './acid-strokes-poster/component';
import { ACID_STROKES_POSTER_TEMPLATE, ACID_STROKES_TEMPLATE_ID } from './acid-strokes-poster/template';
import { GLYPH_SPECIMEN_COMPONENT } from './glyph-specimen-poster/component';
import { GLYPH_SPECIMEN_POSTER_TEMPLATE, GLYPH_SPECIMEN_TEMPLATE_ID } from './glyph-specimen-poster/template';
import { STENCIL_STEPS_COMPONENT } from './stencil-steps-poster/component';
import { STENCIL_STEPS_POSTER_TEMPLATE, STENCIL_STEPS_TEMPLATE_ID } from './stencil-steps-poster/template';

export const POSTER_BATCH_6: [string, TemplateEntry, string][] = [
  [DIAGONAL_PILLS_TEMPLATE_ID, DIAGONAL_PILLS_POSTER_TEMPLATE, DIAGONAL_PILLS_COMPONENT],
  [BLUE_TRAILS_TEMPLATE_ID, BLUE_TRAILS_POSTER_TEMPLATE, BLUE_TRAILS_COMPONENT],
  [STEP_BLOBS_TEMPLATE_ID, STEP_BLOBS_POSTER_TEMPLATE, STEP_BLOBS_COMPONENT],
  [METABALL_LISTING_TEMPLATE_ID, METABALL_LISTING_POSTER_TEMPLATE, METABALL_LISTING_COMPONENT],
  [PIXEL_BURST_TEMPLATE_ID, PIXEL_BURST_POSTER_TEMPLATE, PIXEL_BURST_COMPONENT],
  [ACID_STROKES_TEMPLATE_ID, ACID_STROKES_POSTER_TEMPLATE, ACID_STROKES_COMPONENT],
  [GLYPH_SPECIMEN_TEMPLATE_ID, GLYPH_SPECIMEN_POSTER_TEMPLATE, GLYPH_SPECIMEN_COMPONENT],
  [STENCIL_STEPS_TEMPLATE_ID, STENCIL_STEPS_POSTER_TEMPLATE, STENCIL_STEPS_COMPONENT]
];
