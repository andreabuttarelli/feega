<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { Panel } from '$lib/components/ui/panel';
  import { TEAM_PATH } from '$lib/app-nav';
</script>

<Panel title={$_('app.settings.team.title')}>
  <p class="m-0 text-sm">The team belongs to the organisation: <a href={TEAM_PATH}>manage members and invites</a>.</p>
</Panel>
