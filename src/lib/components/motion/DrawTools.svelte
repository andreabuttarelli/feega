<script lang="ts">
  import { DrawTool } from '$lib/motion/draw-tool';
  import { Command } from '$lib/motion/shortcuts';
  import { ACTIONS, tipText } from '$lib/motion/actions';

  let { tool = $bindable(DrawTool.Select) }: { tool?: DrawTool } = $props();

  const ICON = 15;

  const TOOL_COMMAND: Record<Exclude<DrawTool, DrawTool.Frame>, Command> = {
    [DrawTool.Select]: Command.ToolSelect,
    [DrawTool.Text]: Command.ToolText,
    [DrawTool.Rectangle]: Command.ToolRectangle,
    [DrawTool.Ellipse]: Command.ToolEllipse,
    [DrawTool.Pen]: Command.ToolPen
  };

  const TOOLS = (Object.entries(TOOL_COMMAND) as [DrawTool, Command][]).map(([t, command]) => {
    const tip = tipText(command);
    return { tool: t, label: `${tip.name} (${tip.keys})`, icon: ACTIONS[command].icon };
  });
</script>

<div class="draw-tools nodrag nopan" role="toolbar" aria-label="Draw" data-testid="draw-tools">
  {#each TOOLS as t (t.tool)}
    <button type="button" class:on={tool === t.tool} aria-pressed={tool === t.tool} aria-label={t.label} title={t.label} data-tool={t.tool} onclick={() => (tool = t.tool)}>
      <t.icon size={ICON} />
    </button>
  {/each}
</div>

<style>
  .draw-tools {
    position: absolute;
    bottom: 8px;
    left: 8px;
    z-index: 5;
    display: flex;
    gap: 2px;
    padding: 2px;
    background: var(--ui-bg);
  }

  button {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 9999px;
    background: transparent;
    color: var(--ui-ink);
  }

  button:hover {
    background: var(--ui-hover);
  }

  button.on {
    background: var(--ui-accent-wash);
    color: var(--ui-accent);
  }
</style>
