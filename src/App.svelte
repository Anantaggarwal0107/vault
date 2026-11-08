<script lang="ts">
  import { onMount } from 'svelte';
  import { vault } from './lib/vault.svelte';
  import { router, type Page } from './lib/router.svelte';
  import { ui } from './lib/ui.svelte';
  import { startSync } from './lib/sync';
  import { SOURCES, SOURCE_LABEL } from './lib/types';
  import Icon, { type IconName } from './components/Icon.svelte';
  import DetailSheet from './components/DetailSheet.svelte';
  import ImportPage from './pages/ImportPage.svelte';
  import RandomPage from './pages/RandomPage.svelte';
  import BrowsePage from './pages/BrowsePage.svelte';
  import PeoplePage from './pages/PeoplePage.svelte';
  import MarkedPage from './pages/MarkedPage.svelte';
  import StatsPage from './pages/StatsPage.svelte';
  import SettingsPage from './pages/SettingsPage.svelte';

  let loadError = $state('');

  onMount(async () => {
    // Ask the browser not to evict our data under storage pressure
    // (and on iOS, after 7 days without a visit). Granted automatically for installed apps.
    void navigator.storage?.persist?.().catch(() => {});
    try {
      await vault.load();
      const msg = await startSync((m) => ui.toast(m));
      if (msg && !msg.startsWith('Synced')) ui.toast(msg);
    } catch (e) {
      loadError = (e as Error).message;
    }
  });

  let isIG = $derived(vault.source === 'instagram');
  let nav = $derived<{ page: Page; label: string; icon: IconName }[]>([
    { page: 'random', label: 'Random', icon: 'dice' },
    { page: 'browse', label: isIG ? 'Timeline' : 'Search', icon: isIG ? 'list' : 'search' },
    { page: 'people', label: isIG ? 'Creators' : 'Tags', icon: isIG ? 'people' : 'hash' },
    { page: 'marked', label: 'Marked', icon: 'star' },
    { page: 'stats', label: 'Stats', icon: 'chart' },
  ]);

  let page = $derived(router.route.page);
  let showImport = $derived(page === 'import' || (vault.loaded && !vault.hasAnyData));
  let sourceEmpty = $derived(vault.loaded && vault.hasAnyData && vault.list.length === 0);

  function switchSource(s: (typeof SOURCES)[number]) {
    if (s === vault.source) return;
    vault.setSource(s);
    // A creator page or tag means nothing in the other source.
    if (router.route.arg) router.go(router.route.page);
  }

  $effect(() => {
    document.documentElement.dataset.source = vault.source;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#1a1730');
  });
</script>

<div class="shell">
  <header class="top">
    <a class="brand" href="#/random" aria-label="Vault home">
      <span class="mark" aria-hidden="true"></span>Vault
    </a>
    {#if vault.hasAnyData && !showImport}
      <div class="switch" role="group" aria-label="Which export">
        {#each SOURCES as s (s)}
          <button aria-pressed={vault.source === s} data-source={s} onclick={() => switchSource(s)}>
            {SOURCE_LABEL[s]}
          </button>
        {/each}
      </div>
    {/if}
    {#if vault.hasAnyData}
      <a class="icon-btn" href="#/settings" aria-label="Settings" aria-current={page === 'settings' ? 'page' : undefined}>
        <Icon name="gear" />
      </a>
    {/if}
  </header>

  {#if vault.hasAnyData && !showImport}
    <nav class="tabs" aria-label="Sections">
      {#each nav as n (n.page)}
        <a href="#/{n.page}" aria-current={page === n.page ? 'page' : undefined}>
          <Icon name={n.icon} filled={n.icon === 'star' && page === n.page} />
          <span>{n.label}</span>
        </a>
      {/each}
      <a class="rail-only" href="#/settings" aria-current={page === 'settings' ? 'page' : undefined}>
        <Icon name="gear" /><span>Settings</span>
      </a>
    </nav>
  {/if}

  <main>
    {#if loadError}
      <p class="muted" role="alert">Couldn't open the local database: {loadError}. Private browsing modes can block it.</p>
    {:else if !vault.loaded}
      <p class="muted loading">Opening your vault…</p>
    {:else if showImport}
      <ImportPage />
    {:else if page === 'settings'}
      <SettingsPage />
    {:else if sourceEmpty}
      <div class="stack empty-source">
        <h1>No {SOURCE_LABEL[vault.source]} data yet</h1>
        <p class="muted">Import your {isIG ? 'Instagram export to see your saved posts' : 'X archive to see your likes'} here.</p>
        <a class="btn primary" href="#/import"><Icon name="upload" size={18} /> Import {SOURCE_LABEL[vault.source]} export</a>
      </div>
    {:else if page === 'browse'}
      <BrowsePage />
    {:else if page === 'people'}
      <PeoplePage />
    {:else if page === 'marked'}
      <MarkedPage />
    {:else if page === 'stats'}
      <StatsPage />
    {:else}
      <RandomPage />
    {/if}
  </main>
</div>

<DetailSheet />

<div class="toasts" aria-live="polite">
  {#each ui.toasts as t (t.id)}<div class="toast">{t.text}</div>{/each}
</div>

<style>
  .shell {
    min-height: 100vh;
  }

  .top {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    padding-top: calc(10px + env(safe-area-inset-top));
    background: color-mix(in srgb, var(--night) 88%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--seam);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-right: auto;
    color: var(--paper);
    text-decoration: none;
    font-family: var(--display);
    font-weight: 800;
    font-size: 1.3rem;
    letter-spacing: -0.03em;
  }

  /* Two drawer fronts: one per source. */
  .mark {
    width: 18px;
    height: 20px;
    border-radius: 4px;
    background: linear-gradient(to bottom, var(--ig) 0 45%, transparent 45% 55%, var(--x) 55%);
  }

  .switch {
    display: flex;
    padding: 3px;
    border-radius: 999px;
    background: var(--dusk);
    border: 1px solid var(--seam);
  }

  .switch button {
    min-height: 34px;
    padding: 0 14px;
    border: none;
    border-radius: 999px;
    background: none;
    color: var(--mist);
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
  }

  .switch button[aria-pressed='true'] {
    background: var(--accent);
    color: var(--on-accent);
  }

  main {
    max-width: var(--content);
    margin: 0 auto;
    padding: 20px 16px calc(var(--nav-h) + 32px + env(safe-area-inset-bottom));
  }

  .loading {
    padding: 40px 0;
    text-align: center;
  }

  .empty-source {
    padding-top: 24px;
    justify-items: start;
  }

  /* Bottom tab bar on phones, left rail on wide screens. */
  .tabs {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 30;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    height: calc(var(--nav-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--night);
    border-top: 1px solid var(--seam);
  }

  .tabs a {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 3px;
    color: var(--faint);
    text-decoration: none;
    font-size: 0.72rem;
    font-weight: 700;
  }

  .tabs a[aria-current='page'] {
    color: var(--paper);
  }

  .tabs a[aria-current='page'] :global(svg) {
    color: var(--accent);
  }

  .rail-only {
    display: none !important;
  }

  @media (min-width: 900px) {
    .tabs {
      top: 0;
      right: auto;
      width: 220px;
      height: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 84px 12px 24px;
      border-top: none;
      border-right: 1px solid var(--seam);
      z-index: 25;
    }

    .tabs a,
    .rail-only {
      display: flex !important;
      place-items: initial;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 0.98rem;
    }

    .tabs a:hover {
      background: var(--dusk);
      color: var(--paper);
    }

    .tabs a[aria-current='page'] {
      background: var(--dusk-2);
    }

    main {
      padding-left: calc(220px + 32px);
      padding-right: 32px;
      max-width: calc(var(--content) + 220px + 64px);
      margin: 0;
      padding-bottom: 48px;
    }
  }

  @media (min-width: 1200px) {
    main {
      margin-left: calc((100vw - var(--content) - 220px) / 2 - 64px);
    }
  }

  .toasts {
    position: fixed;
    left: 50%;
    top: calc(72px + env(safe-area-inset-top));
    transform: translateX(-50%);
    z-index: 100;
    display: grid;
    gap: 8px;
    width: min(92vw, 420px);
    pointer-events: none;
  }

  .toast {
    padding: 12px 16px;
    border-radius: 12px;
    background: var(--paper);
    color: var(--night);
    font-weight: 700;
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.4);
    animation: pop 0.2s ease-out;
  }

  @keyframes pop {
    from {
      transform: translateY(-8px);
      opacity: 0;
    }
  }
</style>
