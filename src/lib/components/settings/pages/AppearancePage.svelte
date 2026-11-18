<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { Panel } from '$lib/components/ui/panel';
  import { Field } from '$lib/components/ui/field';
  import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';
</script>

<Panel title={$_('app.settings.appearance.title')}>
  <Field label={$_('app.settings.appearance.theme')} hint={$_('app.settings.appearance.themeDesc')}>
    <ThemeSwitch />
  </Field>
</Panel>
