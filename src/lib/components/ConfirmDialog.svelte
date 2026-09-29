<script lang="ts">
  let {
    open = $bindable(false),
    title,
    body,
    confirmLabel,
    cancelLabel,
    onConfirm
  }: {
    open?: boolean;
    title: string;
    body: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
  } = $props();

  function confirm() {
    open = false;
    onConfirm();
  }
</script>

{#if open}
  <div
    class="cx-overlay"
    role="button"
    tabindex="-1"
    aria-label={cancelLabel}
    onclick={(e) => e.target === e.currentTarget && (open = false)}
    onkeydown={(e) => e.key === 'Escape' && (open = false)}
  >
    <div class="cx-card" role="dialog" aria-modal="true">
      <h3>{title}</h3>
      <p class="cx-sub">{body}</p>
      <div class="cx-actions">
        <button class="bbtn" type="button" onclick={() => (open = false)}>{cancelLabel}</button>
        <button class="bbtn danger" type="button" onclick={confirm}>{confirmLabel}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .cx-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .cx-card {
    background: var(--paper, #fff);
    padding: 26px;
    width: 100%;
    max-width: 440px;
    box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.4);
  }
  .cx-card h3 {
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .cx-sub {
    margin: 0;
    font-size: 14px;
    color: var(--ink-soft, #6e6e73);
    line-height: 1.5;
  }
  .cx-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 22px;
  }
  .bbtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font: inherit;
    font-size: 13.5px;
    font-weight: 600;
    padding: 9px 15px;
    cursor: pointer;
    background: var(--paper-2, #f5f5f7);
    color: var(--ink, #1d1d1f);
    border: 1px solid var(--line, #e3e3e6);
  }
  .bbtn:hover {
    border-color: var(--line-2, #d2d2d7);
  }
  .bbtn.danger {
    background: transparent;
    color: #c0392b;
    border-color: rgba(192, 57, 43, 0.3);
  }
  .bbtn.danger:hover {
    background: rgba(192, 57, 43, 0.06);
    border-color: rgba(192, 57, 43, 0.45);
  }
</style>
