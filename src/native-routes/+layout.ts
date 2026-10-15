import '$lib/i18n';
import { waitLocale } from 'svelte-i18n';
import type { Load as LayoutLoad } from '@sveltejs/kit';
import { createSupabaseBrowserClient } from '$lib/supabase/client';
import { TourState } from '$lib/onboarding/tour';
import { SocialPublishing } from '$lib/social-publishing';

export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async () => {
  await waitLocale();
  const { data } = await createSupabaseBrowserClient().auth.getSession();
  return {
    session: data.session,
    analyticsOptOut: true,
    internalViewer: false,
    planGo: false,
    socialPublishing: SocialPublishing.Off,
    termsNoticeVersion: null,
    tour: TourState.Seen
  };
};
