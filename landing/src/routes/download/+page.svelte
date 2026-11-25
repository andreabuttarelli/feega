<script lang="ts">
  import { browserEnv, installOptions, runOption, type InstallOption } from '$lib/site/install';
  import { EDITOR_ICONS } from '$lib/site/editor-icons';
  import { COFFEE_URL, DESKTOP_DMGS, DESKTOP_PUBLISHED, GITHUB_URL } from '$lib/site/links';
  import { DOWNLOAD_META } from '$lib/site/seo';
  import { downloadJsonLd } from '$lib/site/structured-data';
  import { DOWNLOAD_PAGE } from '$lib/site/download';
  import CommandField from '$lib/site/CommandField.svelte';
  import { eventAttrs } from '$lib/site/analytics/attrs';
  import { APPLE_ICON, LINUX_ICON, WINDOWS_ICON } from '$lib/site/social-icons';

  const editors = installOptions().filter((o) => !o.command);
  const terminal = DOWNLOAD_PAGE.terminal;
  const desktop = DOWNLOAD_PAGE.desktop;
  const systems = [
    { ...desktop.mac, icon: APPLE_ICON, note: desktop.macNote },
    { ...desktop.windows, icon: WINDOWS_ICON, note: desktop.windowsNote },
    { ...desktop.linux, icon: LINUX_ICON, note: desktop.linuxNote, command: desktop.linuxCommand }
  ];

  const copy = (text: string) => navigator.clipboard?.writeText(text);

  function install(option: InstallOption) {
    runOption(option, browserEnv(), copy);
  }
</script>

<svelte:head>
  <title>{DOWNLOAD_META.title}</title>
  <meta name="description" content={DOWNLOAD_META.description} />
  <meta property="og:title" content={DOWNLOAD_META.title} />
  <meta property="og:description" content={DOWNLOAD_META.description} />
  <meta name="twitter:title" content={DOWNLOAD_META.title} />
  <meta name="twitter:description" content={DOWNLOAD_META.description} />
  {@html downloadJsonLd()}
</svelte:head>

<div class="raised">
  <main class="page site-wide">
    <h1>{DOWNLOAD_PAGE.heading}</h1>
    <p class="lead">{DOWNLOAD_PAGE.lead}</p>
    <p class="version">{DOWNLOAD_PAGE.version} · <a href="/changelog">what's new</a></p>

    {#if DESKTOP_PUBLISHED}
      <h2 class="titled"><img src="/img/feega-desktop.png" alt="" width="36" height="36" />{desktop.heading}</h2>
      <p class="lead small">{desktop.lead}</p>
      <h3>{desktop.downloadsLabel}</h3>
      <ul class="systems">
        {#each systems as system (system.name)}
          <li class="system">
            <p class="system-head"><span class="logo">{@html system.icon}</span><span class="name">{system.name}</span>{#if 'badge' in system}<span class="badge">{system.badge}</span>{/if}</p>
            {#each system.files as file (file.target)}
              <a class="install" href={file.href} {...eventAttrs('download_click', { target: file.target, place: 'download_page' })}>{file.label}</a>
            {/each}
            <p class="note">{system.note}</p>
            {#if 'command' in system}<CommandField command={system.command} />{/if}
          </li>
        {/each}
      </ul>
      <h3>{desktop.terminalLabel}</h3>
      <CommandField command={desktop.command} />
      <p class="note">{desktop.terminalNote}</p>
    {/if}

    <h2>{DOWNLOAD_PAGE.editorsHeading}</h2>
    <ul class="cards">
      {#each editors as option (option.label)}
        <li class="card">
          <span class="logo">{@html EDITOR_ICONS[option.label] ?? ''}</span>
          <span class="name">{option.label}</span>
          <button class="install" type="button" onclick={() => install(option)}>install</button>
          <a class="store" href={option.href}>store page</a>
        </li>
      {/each}
    </ul>

    <h2>{terminal.heading}</h2>
    <CommandField command={terminal.command} />
    <p class="note">{terminal.line} {terminal.requirement}.</p>


    <h2>{DOWNLOAD_PAGE.requirements.heading}</h2>
    <ul class="reqs">
      {#each DOWNLOAD_PAGE.requirements.items as item (item)}<li>{item}</li>{/each}
    </ul>

    <p class="links">
      <a href="/changelog">what's new</a>
      <a href={GITHUB_URL} {...eventAttrs('github_click', { place: 'download_source' })}>source</a>
      <a href={GITHUB_URL} {...eventAttrs('github_click', { place: 'download_page' })}>star on github</a>
      <a href={COFFEE_URL}>support with a coffee</a>
    </p>
    <p class="note">{DOWNLOAD_PAGE.privacy}</p>
  </main>
</div>

<style>
  .raised {
    background: var(--site-raised);
  }

  .page {
    padding: 140px 12px var(--site-section);
    color: var(--site-ink);
    font-size: 16px;
    line-height: 1.45;
  }

  h1 {
    margin: 0;
    font-size: 64px;
    line-height: 0.95;
    letter-spacing: -0.05em;
  }

  h2 {
    margin: 56px 0 16px;
    font-size: 28px;
    letter-spacing: -0.04em;
  }

  h3 {
    margin: 28px 0 12px;
    font-size: 18px;
    font-weight: 500;
    letter-spacing: -0.02em;
    opacity: 0.7;
  }

  .lead.small {
    margin: 0;
    font-size: 18px;
  }

  .lead {
    margin: 20px 0 8px;
    font-size: 20px;
    opacity: 0.7;
  }

  .version,
  .note {
    margin: 12px 0 0;
    opacity: 0.7;
  }

  a {
    color: inherit;
  }

  .cards,
  .reqs {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .card {
    display: grid;
    grid-template-columns: 28px 1fr auto;
    align-items: center;
    gap: 6px 14px;
    padding: 16px;
    border: 1px solid var(--site-line);
    border-radius: var(--ui-radius-md, 6px);
    background: #000;
  }

  .systems {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .system {
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 12px;
    padding: 16px;
    border: 1px solid var(--site-line);
    border-radius: var(--ui-radius-md, 6px);
    background: #000;
  }

  .system-head {
    display: flex;
    align-items: center;
    gap: 14px;
    flex: 1 0 100%;
    margin: 0;
  }

  .system .note {
    flex: 1 0 100%;
    margin: 0;
    font-size: 15px;
  }

  .system > :global(div) {
    flex: 1 0 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  }

  .badge {
    padding: 2px 10px;
    border: 1px solid var(--site-line);
    border-radius: 999px;
    font-size: 13px;
    opacity: 0.8;
  }

  .titled {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .titled img {
    border-radius: var(--ui-radius-md, 6px);
  }

  .logo :global(svg) {
    width: 20px;
    height: 20px;
  }

  .install {
    text-decoration: none;
  }

  .logo {
    display: grid;
    place-items: center;
  }

  .name {
    font-size: 20px;
    letter-spacing: -0.02em;
  }

  .store {
    grid-column: 2 / 4;
    font-size: 14px;
    opacity: 0.7;
  }

  .install {
    padding: 8px 18px;
    border: 0;
    border-radius: 999px;
    background: #fff;
    color: #000;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .install:hover {
    opacity: 0.85;
  }

  .reqs li::before {
    content: '';
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: 10px;
    border-radius: var(--ui-radius-xs, 2px);
    background: #ff5100;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 24px;
    margin: 56px 0 0;
  }

  @media (min-width: 810px) {
    .page {
      padding: 160px 0 var(--site-section);
      font-size: 18px;
    }

    h1 {
      font-size: 120px;
    }

    .lead {
      font-size: 26px;
    }

    .cards {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
