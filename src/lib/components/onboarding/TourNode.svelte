<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import { CONNECTOR_STYLE, type ConnectorType } from '$lib/canvas/connectors';
  import { NodeFlow } from '$lib/onboarding/stage';

  let {
    label,
    icon: Icon,
    inputs = [],
    output = null,
    selected = false,
    flow = NodeFlow.Across,
    children
  }: {
    label: string;
    icon: Component<{ size?: number; strokeWidth?: number }>;
    inputs?: ConnectorType[];
    output?: ConnectorType | null;
    selected?: boolean;
    flow?: NodeFlow;
    children: Snippet;
  } = $props();
</script>

<div class="node {flow}" class:selected>
  <div class="label">
    <Icon size={14} strokeWidth={1.8} />
    <span>{label}</span>
  </div>

  <div class="body">{@render children()}</div>

  {#each inputs as port, i (port)}
    <span class="port in" title={CONNECTOR_STYLE[port].label} style:--along="{((i + 1) / (inputs.length + 1)) * 100}%" style:--port={CONNECTOR_STYLE[port].color}>

    </span>
  {/each}

  {#if output}
    <span class="port out" style:--port={CONNECTOR_STYLE[output].color} title={CONNECTOR_STYLE[output].label}></span>
  {/if}
</div>

<style>
  .node {
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--ui-bg, #fff);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-ink, #111) 9%, transparent), 0 18px 40px -24px rgba(0, 0, 0, 0.35);
  }

  .node.selected {
    outline: 2px solid var(--ui-accent, #0099ff);
    outline-offset: 1px;
  }

  .label {
    position: absolute;
    bottom: 100%;
    left: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    font-size: 15px;
    color: var(--ui-ink-2, #5c5c58);
    white-space: nowrap;
  }

  .body {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .port {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 22px;
    font-family: var(--ui-mono, monospace);
    font-size: 12px;
    color: var(--port);
    white-space: nowrap;
  }

  .port::before {
    content: '';
    width: 12px;
    height: 12px;
    background: var(--port);
  }

  .across .in {
    top: var(--along);
    left: 0;
    flex-direction: row-reverse;
    transform: translate(calc(-100% + 6px), -50%);
  }

  .across .out {
    top: 50%;
    right: 0;
    transform: translate(calc(100% - 6px), -50%);
  }

  .down .port {
    height: 12px;
  }

  .down .in {
    top: 0;
    left: var(--along);
    transform: translate(-50%, -50%);
  }

  .down .out {
    bottom: 0;
    left: 50%;
    transform: translate(-50%, 50%);
  }
</style>
