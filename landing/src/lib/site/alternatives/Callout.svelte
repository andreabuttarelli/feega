<script lang="ts">
  import { lower } from '../lower';
  import { CalloutTone, type Callout } from './alternative';
  import { PixelIcon } from './pixel';
  import Pixel from './Pixel.svelte';

  let { item }: { item: Callout } = $props();

  const ICONS: Readonly<Record<CalloutTone, PixelIcon>> = {
    [CalloutTone.Tip]: PixelIcon.Editing,
    [CalloutTone.Warning]: PixelIcon.Help,
    [CalloutTone.Note]: PixelIcon.Stack
  };
</script>

<aside class="callout {item.tone}" data-tone={item.tone}>
  <Pixel icon={ICONS[item.tone]} size={4} />
  <div>
    <strong>{lower(item.title)}</strong>
    <p>{item.text}</p>
  </div>
</aside>
