export type CalendarDelivery = {
  accountId: string;
  platform: string;
  status: string;
  error: string | null;
  scheduledFor: string | null;
};

export type CalendarPost = {
  id: string;
  brandId: string;
  caption: string;
  media: { assetId: string; order: number }[];
  status: string;
  plannedFor: string | null;
  updatedAt: string;
  scheduled: boolean;
  sourceNodeIds: string[];
  deliveries: CalendarDelivery[];
};

export type CalendarBrand = { id: string; name: string };

const CALENDAR_ERRORS: Record<string, string> = {
  brand_required: 'Pick a brand to see its posts.',
  brand_missing: 'Pick a brand on the calendar before dropping material on a day.',
  brand_not_found: 'That brand is not in this workspace.',
  conflict: 'Someone changed this post meanwhile. The calendar has been refreshed, try again.',
  post_not_found: 'This post no longer exists.',
  not_planned: 'Give the draft a day before scheduling it.',
  planned_in_past: 'The planned time has passed. Move the draft to a future day first.',
  no_connected_accounts: 'This brand has no connected social account to publish to.',
  delivery_failed: 'The social network refused the post.',
  node_not_found: 'Some of the dropped nodes are gone.',
  nothing_to_plan: 'Only media and text nodes can become a post.'
};

const FALLBACK_ERROR = 'Something went wrong. Try again.';

export function calendarError(code: unknown, detail?: string): string {
  const text = typeof code === 'string' ? CALENDAR_ERRORS[code] : undefined;
  if (!text) {
    return FALLBACK_ERROR;
  }
  return detail ? `${text} ${detail}` : text;
}
