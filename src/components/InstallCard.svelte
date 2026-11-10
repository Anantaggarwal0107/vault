<script lang="ts">
  import { install } from '../lib/install.svelte';
  import Icon from './Icon.svelte';

  /** `always` ignores "Not now" (used in Settings). */
  let { always = false }: { always?: boolean } = $props();

  let show = $derived(install.available && (always || !install.dismissed));
</script>

{#if show}
  <aside class="install" aria-label="Install Vault">
    <div class="text">
      <strong>Put Vault on your home screen</strong>
      {#if install.canPrompt}
        <p class="muted small">It opens like an app, works offline, and your phone won't clear your favourites.</p>
      {:else}
        <p class="muted small">
          In Safari, tap the <span class="share" aria-label="Share">Share</span> button, then <strong>Add to Home Screen</strong>. It opens
          like an app, and your iPhone won't clear your favourites.
        </p>
      {/if}
    </div>
    <div class="row">
      {#if install.canPrompt}
        <button class="btn primary" onclick={() => install.prompt()}><Icon name="upload" size={18} /> Install</button>
      {/if}
      {#if !always}
        <button class="btn ghost" onclick={() => install.dismiss()}>Not now</button>
      {/if}
    </div>
  </aside>
{/if}

<style>
  .install {
    display: grid;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--seam));
    background: var(--dusk);
  }

  .text {
    display: grid;
    gap: 4px;
  }

  .share {
    display: inline-block;
    padding: 0 6px;
    border: 1px solid var(--seam);
    border-radius: 6px;
    color: var(--paper);
  }
</style>
