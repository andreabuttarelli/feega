import { mount } from 'svelte';
import InfluencerPicker from '../../../src/lib/components/studio/InfluencerPicker.svelte';

type Influencer = { id: string; name: string; cover: string | null; allowed: boolean; why: string };

declare global {
  interface Window {
    influencerPicker: { mount: (models: Influencer[]) => void; picked: string[] };
  }
}

window.influencerPicker = {
  picked: [],
  mount: (models) => {
    document.body.replaceChildren();
    const props = $state({
      models,
      selected: [] as string[],
      createHref: '/p/p1/influencers',
      onchange: (next: string[]) => {
        props.selected = next;
        window.influencerPicker.picked = next;
      }
    });
    mount(InfluencerPicker, { target: document.body, props });
  }
};
