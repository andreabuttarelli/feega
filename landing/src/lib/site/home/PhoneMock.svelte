<script lang="ts">
  import { MARK } from '../editor-mock/glyphs';

  const REQUEST = 'make the hero headline bigger';
  const DIFF = [
    { sign: '-', text: 'font-size: 48px;', kind: 'del' },
    { sign: '+', text: 'font-size: 80px;', kind: 'add' }
  ];
  const FIELDS = [
    { label: 'Font', value: 'BDO Grotesk' },
    { label: 'Size', value: '14 px' },
    { label: 'Height', value: '17 px' },
    { label: 'Align', value: 'Center' },
    { label: 'Colour', value: '#f0eee9' }
  ];
</script>

<div class="phone" role="img" aria-label="The Feega editor: a live page preview with the selected paragraph and its typography properties, and Claude Code writing the change as a diff">
  <div class="editor">
    <header class="bar">
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">{@html MARK}</svg>
      <span class="address"><i></i>/</span>
      <span class="modes"><b class="on">Design</b><b>Navigate</b></span>
    </header>

    <div class="body">
      <div class="preview">
        <div class="page">
          <span class="brand">Aurel</span>
          <h2>Scent, slowly made.</h2>
          <p class="pick"><span class="tag">p.lead</span>Small-batch perfume, blended by hand in Grasse.</p>
          <span class="cta">Shop the collection</span>
        </div>
      </div>

      <aside class="props">
        <span class="tab">Properties</span>
        <span class="crumb">Hero › <b>p.lead</b></span>
        <span class="head">Typography</span>
        {#each FIELDS as f (f.label)}
          <div class="row"><span>{f.label}</span><em>{f.value}</em></div>
        {/each}
      </aside>
    </div>
  </div>

  <div class="term" role="presentation">
    <p class="ask"><span class="chev">&gt;</span> {REQUEST}</p>
    {#each DIFF as line (line.text)}
      <p class={line.kind}><span class="sign">{line.sign}</span>{line.text}</p>
    {/each}
  </div>
</div>

<style>
  .phone {
    position: relative;
    padding-bottom: 54px;
    pointer-events: none;
    user-select: none;
    text-align: left;
  }

  .editor {
    --accent: #0a84ff;
    --text: #cccccc;
    --text-2: rgba(204, 204, 204, 0.6);
    --input: #262626;
    --divider: #2b2b2b;

    overflow: hidden;
    border-radius: var(--ui-radius-lg, 10px);
    background: #181818;
    box-shadow: 0 0 0 1px #3c3c3c, 0 16px 40px rgb(0 0 0 / 0.5);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 10px;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 30px;
    padding: 0 10px;
    border-bottom: 1px solid var(--divider);
  }

  .address {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 6px;
    height: 20px;
    padding: 0 8px;
    border-radius: 9999px;
    background: var(--input);
    color: var(--text-2);
  }

  .address i {
    width: 6px;
    height: 6px;
    border-radius: 9999px;
    background: #30d158;
  }

  .modes {
    display: flex;
    padding: 2px;
    border-radius: 9999px;
    background: var(--input);
  }

  .modes b {
    padding: 2px 7px;
    border-radius: 9999px;
    color: var(--text-2);
    font-weight: 400;
  }

  .modes .on {
    background: #5a5a5e;
    color: #fff;
  }

  .body {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    min-height: 196px;
  }

  .preview {
    background: #1f1f1f;
    padding: 8px 0 0 8px;
  }

  .page {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    height: 100%;
    padding: 10px 10px 0;
    background: #f6efe6;
    color: #2a1c12;
    font-family: 'Inter', -apple-system, system-ui, sans-serif;
  }

  .brand {
    font: 600 11px Georgia, serif;
  }

  h2 {
    margin: 4px 0 0;
    font: 500 24px/1 Georgia, serif;
    letter-spacing: -0.03em;
  }

  .pick {
    position: relative;
    margin: 6px 0 0;
    padding: 2px 3px;
    outline: 2px solid var(--accent);
    color: #6b5645;
    font-size: 10px;
    line-height: 13px;
  }

  .tag {
    position: absolute;
    top: -15px;
    left: -2px;
    padding: 0 4px;
    border-radius: 2px;
    background: var(--accent);
    color: #fff;
    font-size: 9px;
    line-height: 13px;
  }

  .cta {
    margin-top: 4px;
    padding: 5px 10px;
    border-radius: 9999px;
    background: #2a1c12;
    color: #fff;
    font-size: 9px;
    font-weight: 600;
  }

  .props {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    border-left: 1px solid var(--divider);
  }

  .tab {
    align-self: flex-start;
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--input);
  }

  .crumb {
    color: var(--text-2);
  }

  .crumb b {
    color: var(--text);
  }

  .head {
    margin-top: 2px;
    font-size: 10px;
    font-weight: 600;
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: var(--text-2);
    font-size: 9px;
  }

  .row em {
    padding: 4px 6px;
    border-radius: 4px;
    background: var(--input);
    color: var(--text);
    font-size: 10px;
    font-style: normal;
  }

  .term {
    position: absolute;
    right: -6px;
    bottom: 0;
    width: 62%;
    padding: 8px 10px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 8px;
    background: #121212;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
    color: #d8d8d8;
    font: 9px/1.5 ui-monospace, 'SF Mono', Menlo, monospace;
  }

  .term p {
    margin: 0;
    overflow: hidden;
    white-space: pre;
    text-overflow: ellipsis;
  }

  .chev {
    margin-right: 4px;
    color: #ff5100;
  }

  .ask {
    margin-bottom: 4px;
  }

  .sign {
    display: inline-block;
    width: 14px;
    text-align: center;
  }

  .add { background: rgba(40, 200, 64, 0.16); color: #7ee08e; }
  .del { background: rgba(255, 70, 70, 0.16); color: #ff8f8f; }
</style>
