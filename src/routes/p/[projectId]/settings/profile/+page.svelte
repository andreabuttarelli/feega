<script lang="ts">
  import { enhance } from '$app/forms';
  import { _ } from 'svelte-i18n';
  import { SvelteSet } from 'svelte/reactivity';
  import { jpegIfHeicFormFiles } from '$lib/raster-image-client';
  import { RASTER_IMAGE_ACCEPT } from '$lib/raster-image';
  import { Panel } from '$lib/components/ui/panel';
  import { Field, FieldLayout } from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';
  import { Button, buttonVariants } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';
  import { openCookieSettings } from '$lib/consent';
  import LegalFooter from '$lib/components/LegalFooter.svelte';

  let { data, form } = $props();

  const DELETE_ERROR_KEY = {
    confirm: 'app.settings.profile.deleteConfirmError',
    reauth: 'app.settings.profile.deleteReauth',
    transfer: 'app.settings.profile.deleteTransfer'
  } as const;

  const busy = new SvelteSet<string>();
  const isBusy = (key: string) => busy.has(key);
  const withBusy = (key: string) => () => {
    busy.add(key);
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      busy.delete(key);
    };
  };

  const initials = $derived(
    [data.firstName, data.lastName]
      .filter(Boolean)
      .map((s: string) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || (data.email?.[0]?.toUpperCase() ?? '?')
  );
</script>

{#if form?.profileSaved}
  <Notice tone="success">{$_('app.settings.profile.saved')}</Notice>
{:else if form?.avatarUploaded}
  <Notice tone="success">{$_('app.settings.profile.avatarSaved')}</Notice>
{:else if form?.avatarRemoved}
  <Notice tone="success">{$_('app.settings.profile.avatarRemoved')}</Notice>
{:else if form?.error === 'too_large'}
  <Notice tone="error">{$_('app.settings.profile.tooLarge')}</Notice>
{:else if form?.error === 'not_image'}
  <Notice tone="error">{$_('app.settings.profile.notImage')}</Notice>
{/if}

<Panel title={$_('app.settings.profile.title')}>
  <div class="flex items-start gap-4">
    <div class="avatar-preview">
      {#if data.avatarUrl}
        <img src={data.avatarUrl} alt="" />
      {:else}
        <span>{initials}</span>
      {/if}
    </div>
    <Field label={$_('app.settings.profile.photo')} hint={$_('app.settings.profile.photoDesc')} class="flex-1">
      <div class="flex flex-wrap gap-2">
        <form
          method="POST"
          action="?/uploadProfileAvatar"
          enctype="multipart/form-data"
          use:enhance={async ({ formData }) => {
            await jpegIfHeicFormFiles(formData, 'avatar');
            return withBusy('avatar')();
          }}
        >
          <label class={buttonVariants({ variant: 'secondary', size: 'sm' })} class:busy={isBusy('avatar')}>
            {$_('app.settings.profile.uploadPhoto')}
            <input
              type="file"
              name="avatar"
              accept={RASTER_IMAGE_ACCEPT}
              hidden
              onchange={(e) => e.currentTarget.form?.requestSubmit()}
            />
          </label>
        </form>
        {#if data.hasCustomAvatar}
          <form method="POST" action="?/removeProfileAvatar" use:enhance={withBusy('avatar')}>
            <Button variant="ghost" size="sm" type="submit" disabled={isBusy('avatar')}>{$_('app.settings.profile.removePhoto')}</Button>
          </form>
        {/if}
      </div>
    </Field>
  </div>

  <form method="POST" action="?/updateProfile" use:enhance={withBusy('profile')} class="m-0 flex flex-col gap-3">
    <Field label={$_('app.settings.profile.name')} hint={$_('app.settings.profile.nameDesc')}>
      <div class="name-row">
        <label class="flex flex-col gap-1.5 text-[0.8125rem] text-muted-foreground" for="profile-first-name">
          {$_('app.settings.profile.firstName')}
          <Input
            id="profile-first-name"
            name="firstName"
            value={data.firstName}
            maxlength={80}
            autocomplete="given-name"
            disabled={isBusy('profile')}
            class="h-9"
          />
        </label>
        <label class="flex flex-col gap-1.5 text-[0.8125rem] text-muted-foreground" for="profile-last-name">
          {$_('app.settings.profile.lastName')}
          <Input
            id="profile-last-name"
            name="lastName"
            value={data.lastName}
            maxlength={80}
            autocomplete="family-name"
            disabled={isBusy('profile')}
            class="h-9"
          />
        </label>
      </div>
    </Field>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="m-0 text-[0.8125rem] text-muted-foreground">{data.email ?? ''}</p>
      <Button type="submit" disabled={isBusy('profile')}>{$_('app.settings.save')}</Button>
    </div>
  </form>
</Panel>

<Panel title={$_('app.settings.profile.session')}>
  <Field label={$_('app.account.signOut')} hint={$_('app.settings.profile.signOutDesc')} layout={FieldLayout.Row}>
    <form method="POST" action="/auth/signout">
      <Button variant="secondary" type="submit">{$_('app.account.signOut')}</Button>
    </form>
  </Field>
</Panel>

<Panel title={$_('app.settings.profile.privacy')}>
  <Field label={$_('cookie.settings')} hint={$_('app.settings.profile.cookieHint')} layout={FieldLayout.Row}>
    <Button variant="secondary" type="button" onclick={openCookieSettings} data-testid="open-cookie-settings">{$_('cookie.settings')}</Button>
  </Field>
  <Field label={$_('app.settings.profile.exportData')} hint={$_('app.settings.profile.exportHint')} layout={FieldLayout.Row}>
    <a class={buttonVariants({ variant: 'secondary' })} href="/account/export" download data-testid="export-data">{$_('app.settings.profile.exportData')}</a>
  </Field>
</Panel>

<Panel title={$_('app.settings.profile.deleteAccount')}>
  <p class="m-0 text-[0.8125rem] text-muted-foreground">{$_('app.settings.profile.deleteHint')}</p>
  {#if form?.deleteError}
    <Notice tone="error">{$_(DELETE_ERROR_KEY[form.deleteError as keyof typeof DELETE_ERROR_KEY])}</Notice>
  {/if}
  <form method="POST" action="?/deleteAccount" use:enhance={withBusy('delete')} class="m-0 flex flex-col gap-3">
    <label class="flex flex-col gap-1.5 text-[0.8125rem] text-muted-foreground" for="delete-confirm">
      {$_('app.settings.profile.deleteConfirmLabel')}
      <Input id="delete-confirm" name="confirm" autocomplete="off" class="h-9" data-testid="delete-confirm" />
    </label>
    <div>
      <Button variant="danger" type="submit" disabled={isBusy('delete')} data-testid="delete-account">{$_('app.settings.profile.deleteAccount')}</Button>
    </div>
  </form>
</Panel>

<div class="legal-wrap">
  <LegalFooter />
</div>

<style>
  .legal-wrap {
    margin-top: 1.5rem;
  }
  .avatar-preview {
    width: 64px;
    height: 64px;
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--paper-2);
    border: 1px solid var(--line);
    color: var(--ink-soft);
    font-size: 18px;
    font-weight: 700;
  }
  .avatar-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .name-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .busy {
    opacity: 0.55;
    pointer-events: none;
  }
  @media (max-width: 560px) {
    .name-row {
      grid-template-columns: 1fr;
    }
  }
</style>
