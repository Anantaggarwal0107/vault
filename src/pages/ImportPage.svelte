<script lang="ts">
  import { readFiles } from '../lib/parse/importer';
  import { vault } from '../lib/vault.svelte';
  import { router } from '../lib/router.svelte';
  import { ui } from '../lib/ui.svelte';
  import { fmtDate, fmtNum } from '../lib/text';
  import { migrateAfterImport } from '../lib/sync';
  import type { Source } from '../lib/types';
  import Icon from '../components/Icon.svelte';

  const EXPORT_PAGE: Record<Source, string> = {
    instagram: 'https://accountscenter.instagram.com/info_and_permissions/dyi/',
    x: 'https://x.com/settings/download_your_data',
  };
  const REQUESTED_KEY = 'vault.requested';

  let busy = $state(false);
  let status = $state('');
  let error = $state('');
  let notes = $state<string[]>([]);
  let dragging = $state(false);
  let input: HTMLInputElement | undefined = $state();
  let guide = $state<Source>(vault.source);
  let requested = $state<Partial<Record<Source, number>>>(JSON.parse(localStorage.getItem(REQUESTED_KEY) ?? '{}'));

  let hasRealData = $derived(vault.hasAnyData && !vault.isDemo);

  function markRequested(s: Source) {
    requested = { ...requested, [s]: Date.now() };
    localStorage.setItem(REQUESTED_KEY, JSON.stringify(requested));
  }

  async function handle(files: File[]) {
    if (!files.length || busy) return;
    busy = true;
    error = '';
    notes = [];
    try {
      const r = await readFiles(files, (s) => (status = s));
      notes = r.notes;
      const done: string[] = [];
      if (r.instagram?.length || r.x?.length) await vault.clearDemo();
      if (r.instagram?.length) {
        status = 'Saving your Instagram posts…';
        await vault.replaceItems('instagram', r.instagram);
        done.push(`${fmtNum(r.instagram.length)} Instagram posts`);
      }
      if (r.x?.length) {
        status = 'Saving your X likes…';
        await vault.replaceItems('x', r.x);
        done.push(`${fmtNum(r.x.length)} X likes`);
      }
      if (done.length) {
        vault.setSource(r.instagram?.length ? 'instagram' : 'x');
        ui.toast(`Added ${done.join(' and ')}.`);
        migrateAfterImport()
          .then((m) => m && ui.toast(m))
          .catch((e) => ui.toast(`Couldn't move old favourites from your gist: ${(e as Error).message}`));
        if (!notes.length) router.go('random');
      } else if (!notes.length) {
        error = "Those files don't have any saved posts or likes in them. Choose the zip file Instagram or X emailed you.";
      }
    } catch (e) {
      error = `Vault couldn't read that file. Try choosing the zip file exactly as it came from the email. (${(e as Error).message})`;
    } finally {
      busy = false;
      status = '';
    }
  }

  async function tryDemo() {
    await vault.loadDemo();
    router.go('random');
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    void handle([...(e.dataTransfer?.files ?? [])]);
  }
</script>

{#snippet picker(label: string)}
  <button
    class="drop"
    class:dragging
    disabled={busy}
    onclick={() => input?.click()}
    ondragover={(e) => {
      e.preventDefault();
      dragging = true;
    }}
    ondragleave={() => (dragging = false)}
    ondrop={onDrop}
  >
    <Icon name="upload" size={28} />
    {#if busy}
      <strong>{status || 'Working…'}</strong>
    {:else}
      <strong>{label}</strong>
      <span class="muted small">The zip from Instagram or X, as it came. You can pick both at once.</span>
    {/if}
  </button>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#each notes as n (n)}<p class="note small" role="status">{n}</p>{/each}
{/snippet}

<div class="import">
  <!-- No `accept` filter: some phones grey out valid files when it's set. Files are detected by content. -->
  <input
    bind:this={input}
    class="sr-only"
    type="file"
    multiple
    onchange={(e) => {
      void handle([...(e.currentTarget.files ?? [])]);
      e.currentTarget.value = '';
    }}
  />

  {#if hasRealData}
    <header class="intro">
      <h1>Add or update your posts</h1>
      <p class="lede">Choose a newer download to refresh your posts. Your favourites stay where they are.</p>
    </header>
    {@render picker('Choose your file')}
  {:else}
    <header class="intro">
      <h1>Everything you ever saved, in one place.</h1>
      <p class="lede">
        Bring in your saved Instagram posts and liked tweets, then shuffle through them, find old favourites and tidy up. It all stays on
        this phone.
      </p>
    </header>
  {/if}

  <section class="guide" aria-label="How to get your file">
    <h2>{hasRealData ? 'Getting a fresh download' : 'Get your file in three steps'}</h2>
    <div class="segmented" role="tablist">
      <button role="tab" aria-selected={guide === 'instagram'} onclick={() => (guide = 'instagram')}>Instagram</button>
      <button role="tab" aria-selected={guide === 'x'} onclick={() => (guide = 'x')}>X (Twitter)</button>
    </div>

    <ol class="steps" data-source={guide}>
      <li>
        <span class="n" aria-hidden="true">1</span>
        <div class="body">
          <h3>Ask {guide === 'x' ? 'X' : 'Instagram'} for your file</h3>
          {#if guide === 'instagram'}
            <p class="muted">
              On the page that opens, tap <b>Download or transfer information</b>, choose your account, then <b>Some of your information</b>.
              Instagram ticks every box to start with, so <b>untick everything, then tick only Saved</b> (it's further down the list) and tap
              <b>Save</b>. Then choose <b>Download to device</b>, set the date range to <b>All time</b> and tap <b>Create files</b>. Leaving
              the rest unticked keeps the file small and makes it arrive sooner.
            </p>
          {:else}
            <p class="muted">
              On the page that opens, confirm your password and tap <b>Request archive</b>. You may need to enter a code X sends you.
            </p>
          {/if}
          <a
            class="btn primary"
            href={EXPORT_PAGE[guide]}
            target="_blank"
            rel="noopener"
            onclick={() => markRequested(guide)}
          >
            <Icon name="open" size={18} /> Open {guide === 'x' ? 'X' : 'Instagram'}'s download page
          </a>
        </div>
      </li>
      <li>
        <span class="n" aria-hidden="true">2</span>
        <div class="body">
          <h3>Wait for the email</h3>
          <p class="muted">
            {guide === 'x' ? 'X' : 'Instagram'} emails you when your file is ready. It usually takes a few hours, sometimes a day or two.
          </p>
          {#if requested[guide]}
            <p class="waiting small">You asked on {fmtDate(requested[guide]!)}. Check your email for a message from {guide === 'x' ? 'X' : 'Instagram'}.</p>
          {/if}
        </div>
      </li>
      <li>
        <span class="n" aria-hidden="true">3</span>
        <div class="body">
          <h3>Download it and choose it here</h3>
          <p class="muted">
            Tap the link in the email to download the zip file. You don't need to open it, just choose it below.
            {#if guide === 'x'}The X file can be big, so use Wi-Fi.{/if}
          </p>
        </div>
      </li>
    </ol>
  </section>

  {#if !hasRealData}
    {@render picker('Choose your downloaded file')}
    {#if !vault.isDemo}
      <button class="btn ghost block" onclick={tryDemo}>Not ready yet? Look around with sample posts</button>
    {/if}
  {/if}
</div>

<style>
  .import {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    padding-top: 12px;
  }

  .intro {
    display: grid;
    gap: 12px;
  }

  .intro h1 {
    font-size: clamp(2.1rem, 9vw, 3.3rem);
    font-weight: 800;
    letter-spacing: -0.035em;
    max-width: 14ch;
  }

  .lede {
    color: var(--mist);
    font-size: 1.08rem;
    max-width: 52ch;
  }

  .drop {
    display: grid;
    justify-items: center;
    gap: 8px;
    padding: 32px 20px;
    border: 2px dashed var(--seam);
    border-radius: 20px;
    background: var(--dusk);
    color: var(--paper);
    text-align: center;
    cursor: pointer;
    transition: border-color 0.15s, background-color 0.15s;
  }

  .drop strong {
    font-family: var(--display);
    font-size: 1.25rem;
  }

  .drop:hover,
  .drop.dragging {
    border-color: var(--accent);
    background: var(--dusk-2);
  }

  .drop:disabled {
    cursor: progress;
  }

  .error {
    color: #ffb3c0;
  }

  .note {
    color: var(--gold);
  }

  .guide {
    display: grid;
    gap: 12px;
  }

  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0;
  }

  .steps li {
    display: grid;
    grid-template-columns: 36px 1fr;
    gap: 14px;
    padding: 16px 0;
    border-bottom: 1px solid var(--seam);
  }

  .steps li:last-child {
    border-bottom: none;
  }

  .n {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid var(--accent);
    color: var(--accent);
    font-family: var(--display);
    font-weight: 800;
  }

  .body {
    display: grid;
    gap: 8px;
    justify-items: start;
  }

  /* Long button labels wrap on narrow phones instead of widening the page. */
  .body .btn {
    white-space: normal;
    min-height: 48px;
    padding: 10px 16px;
    text-align: left;
  }

  .body p {
    max-width: 58ch;
  }

  b {
    color: var(--paper);
    font-weight: 700;
  }

  .waiting {
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--dusk-2);
    color: var(--paper);
  }
</style>
