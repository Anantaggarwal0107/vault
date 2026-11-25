<script lang="ts">
  import { vault } from '../lib/vault.svelte';
  import { ui } from '../lib/ui.svelte';
  import { openUrl } from '../lib/links';
  import { fmtDate, fmtNum, previewText } from '../lib/text';
  import type { Item, Pool } from '../lib/types';
  import Icon from '../components/Icon.svelte';
  import Embed from '../components/Embed.svelte';
  import ItemRow from '../components/ItemRow.svelte';
  import InstallCard from '../components/InstallCard.svelte';
  import SyncCard from '../components/SyncCard.svelte';
  import CopyCard from '../components/CopyCard.svelte';
  import { install } from '../lib/install.svelte';

  const POOLS: { id: Pool; label: string }[] = [
    { id: 'all', label: 'Everything' },
    { id: 'fav', label: 'Favourites' },
    { id: 'unmarked', label: 'Unsorted' },
    { id: 'del', label: 'Gone' },
  ];

  let source = $derived(vault.source);
  let pool = $derived(ui.randomPool[source]);
  let pick = $derived(ui.randomPick[source]);
  let mark = $derived.by(() => {
    void vault.version;
    return pick ? vault.markOf(pick.key) : undefined;
  });
  let poolSize = $derived(vault.pool(pool).length);
  let draws = $state(0);

  // With the preview on, size it to exactly the space between the header and the bottom bar.
  let slot: HTMLElement | undefined = $state();
  let bar: HTMLElement | undefined = $state();
  let fitH = $state(420);

  function measure() {
    if (!slot || !bar) return;
    const slotTop = slot.getBoundingClientRect().top + window.scrollY;
    const barTop = bar.getBoundingClientRect().top;
    fitH = Math.max(280, Math.floor(barTop - slotTop - 10));
  }

  $effect(() => {
    void pick?.key;
    void ui.showPreview;
    void slot;
    requestAnimationFrame(measure);
  });

  // Shrink long handles so they fit on one line instead of breaking mid-word.
  let whoSize = $derived.by(() => {
    const len = (pick?.author.length ?? 7) + 1;
    return `min(clamp(2.3rem, 11vw, 4rem), calc((min(100vw, 680px) - 92px) / ${(len * 0.5).toFixed(2)}))`;
  });

  function draw() {
    const items = vault.pool(pool);
    if (!items.length) {
      ui.toast(pool === 'all' ? 'No posts yet.' : 'Nothing in this pool yet.');
      return;
    }
    let next: Item;
    do {
      next = items[Math.floor(Math.random() * items.length)];
    } while (items.length > 1 && next.key === pick?.key);
    ui.randomPick[source] = next;
    draws++;
  }

  function setPool(p: Pool) {
    ui.randomPool[source] = p;
  }

  // "On this day": things from today's date in earlier years.
  let onThisDay = $derived.by(() => {
    const now = new Date();
    const m = now.getMonth();
    const d = now.getDate();
    const y = now.getFullYear();
    return vault.list
      .filter((it) => {
        if (!it.savedAt) return false;
        const t = new Date(it.savedAt);
        return t.getMonth() === m && t.getDate() === d && t.getFullYear() < y;
      })
      .sort((a, b) => b.savedAt - a.savedAt);
  });
  let showAllOtd = $state(false);

  function yearsAgo(ms: number): string {
    const n = new Date().getFullYear() - new Date(ms).getFullYear();
    return n === 1 ? 'a year ago' : `${n} years ago`;
  }

  function onKey(e: KeyboardEvent) {
    if (ui.detail || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target as HTMLElement;
    if (el.closest('input, select, textarea')) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'r') {
      if (el.closest('button, a') && k === ' ') return;
      e.preventDefault();
      draw();
    } else if (pick && k === 'f') vault.toggle(pick, 'fav');
    else if (pick && k === 'd') vault.toggle(pick, 'del');
    else if (pick && k === 'o') window.open(openUrl(pick), '_blank', 'noopener');
    else if (pick && k === 'p') ui.togglePreview();
    else if (pick && k === 'i') ui.detail = pick;
  }
</script>

<svelte:window onkeydown={onKey} onresize={measure} />

{#snippet actionButtons(compact: boolean)}
  <button
    class={compact ? 'icon-btn' : 'btn'}
    class:on-fav={compact && mark === 'fav'}
    class:fav-on={!compact && mark === 'fav'}
    aria-pressed={mark === 'fav'}
    aria-label={mark === 'fav' ? 'Remove favourite' : 'Favourite'}
    onclick={() => vault.toggle(pick!, 'fav')}
  >
    <Icon name="star" size={compact ? 22 : 20} filled={mark === 'fav'} />{#if !compact}<span class="lbl">Favourite</span>{/if}
  </button>
  <button
    class={compact ? 'icon-btn' : 'btn'}
    class:on-del={compact && mark === 'del'}
    class:del-on={!compact && mark === 'del'}
    aria-pressed={mark === 'del'}
    aria-label={mark === 'del' ? 'Unmark as gone' : 'Mark as gone'}
    onclick={() => vault.toggle(pick!, 'del')}
  >
    <Icon name="trash" size={compact ? 22 : 20} />{#if !compact}<span class="lbl">Gone</span>{/if}
  </button>
  <button
    class={compact ? 'icon-btn' : 'btn'}
    class:on-preview={compact && ui.showPreview}
    aria-pressed={ui.showPreview}
    aria-label={ui.showPreview ? 'Hide preview' : 'Show preview'}
    onclick={() => ui.togglePreview()}
  >
    <Icon name="eye" size={compact ? 22 : 20} />{#if !compact}<span class="lbl">Preview</span>{/if}
  </button>
  <button class={compact ? 'icon-btn' : 'btn'} aria-label="More details" onclick={() => (ui.detail = pick)}>
    <Icon name="more" size={compact ? 22 : 20} />{#if !compact}<span class="lbl">More</span>{/if}
  </button>
{/snippet}

<div class="random" class:previewing={pick && ui.showPreview}>
  <div class="segmented" role="group" aria-label="Draw from">
    {#each POOLS as p (p.id)}
      <button aria-pressed={pool === p.id} onclick={() => setPool(p.id)}>{p.label}</button>
    {/each}
  </div>

  {#if pick && ui.showPreview}
    <!-- Preview on: a slim header and the preview filling the rest of the screen, so nothing needs scrolling. -->
    {#key draws}
      <article class="mini" class:del={mark === 'del'}>
        <div class="mini-top">
          <button class="mini-who" onclick={() => (ui.detail = pick)}>
            {#if pick.source === 'instagram'}
              <span class="mini-name">@{pick.author || 'unknown'}</span>
            {:else}
              <span class="mini-name tweet">{previewText(pick.text)}</span>
            {/if}
            <span class="mini-meta">
              <span class="num">{pick.source === 'x' ? 'Posted' : 'Saved'} {fmtDate(pick.savedAt)}</span>
              {#if mark === 'fav'}<span class="badge fav"><Icon name="star" size={14} filled /> Favourite</span>{/if}
              {#if mark === 'del'}<span class="badge"><Icon name="trash" size={14} /> Gone</span>{/if}
            </span>
          </button>
          <div class="mini-actions">{@render actionButtons(true)}</div>
        </div>
        {#if pick.source === 'instagram' && pick.text}<p class="mini-caption">{pick.text}</p>{/if}
      </article>
    {/key}
    <div class="fit-slot" bind:this={slot} style:height="{fitH}px">
      <Embed item={pick} fit />
    </div>
  {:else if pick}
    <p class="muted small pool-count num">{fmtNum(poolSize)} to draw from</p>
    {#key draws}
      <article class="card" class:del={mark === 'del'}>
        {#if pick.source === 'instagram'}
          <button class="who" style:font-size={whoSize} onclick={() => (ui.detail = pick)}>@{pick.author || 'unknown'}</button>
          {#if pick.text}<p class="caption">{pick.text}</p>{/if}
        {:else}
          <button class="what" onclick={() => (ui.detail = pick)}>{previewText(pick.text)}</button>
        {/if}
        <div class="stamp-row">
          <span class="stamp">
            <span class="stamp-k">{pick.source === 'x' ? 'Posted' : 'Saved'}</span>
            <span class="stamp-v num">{fmtDate(pick.savedAt)}</span>
          </span>
          {#if mark === 'fav'}<span class="badge fav"><Icon name="star" size={16} filled /> Favourite</span>{/if}
          {#if mark === 'del'}<span class="badge"><Icon name="trash" size={16} /> Gone</span>{/if}
        </div>
      </article>
    {/key}
    <div class="actions">{@render actionButtons(false)}</div>
  {:else}
    <p class="muted small pool-count num">{fmtNum(poolSize)} to draw from</p>
    <article class="card empty">
      <p class="who dim">Nothing drawn yet</p>
      <p class="muted">Draw a random {source === 'x' ? 'like' : 'save'} and see what past you thought was worth keeping.</p>
    </article>
  {/if}

  {#if !vault.isDemo}
    {#if ui.offerCopy}<CopyCard offer />
    {:else if install.available && !install.dismissed}<InstallCard />
    {:else}<SyncCard prompt />{/if}
  {/if}

  {#if onThisDay.length}
    <section class="otd">
      <h2>On this day</h2>
      <p class="muted small">
        {fmtNum(onThisDay.length)}
        {source === 'x' ? 'liked tweets were posted' : 'posts were saved'} on {new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
        })} in earlier years, most recently {yearsAgo(onThisDay[0].savedAt)}.
      </p>
      <ul>
        {#each showAllOtd ? onThisDay : onThisDay.slice(0, 3) as item (item.key)}<ItemRow {item} />{/each}
      </ul>
      {#if onThisDay.length > 3}
        <button class="btn ghost block" onclick={() => (showAllOtd = !showAllOtd)}>
          {showAllOtd ? 'Show fewer' : `Show all ${fmtNum(onThisDay.length)}`}
        </button>
      {/if}
    </section>
  {/if}

  <p class="keys muted small">Keys: <kbd>R</kbd> draw, <kbd>F</kbd> favourite, <kbd>D</kbd> gone, <kbd>O</kbd> open, <kbd>P</kbd> preview</p>

  <div class="draw-bar" bind:this={bar}>
    <div class="bar-inner" class:two={!!pick}>
      {#if pick}
        <a class="btn lg open" href={openUrl(pick)} target="_blank" rel="noopener">
          <Icon name="open" size={20} /> Open
        </a>
      {/if}
      <button class="btn primary lg draw" onclick={draw}>
        <Icon name="dice" size={22} />
        {pick ? 'Draw another' : 'Draw a random post'}
      </button>
    </div>
  </div>
</div>

<style>
  .random {
    display: grid;
    gap: 14px;
    padding-bottom: 96px;
  }

  .pool-count {
    margin-top: -6px;
  }

  /* The one loud moment: the drawn card. */
  .card {
    position: relative;
    display: grid;
    gap: 18px;
    padding: 28px 22px 24px;
    min-height: 210px;
    align-content: center;
    border-radius: 22px;
    background:
      radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 60%),
      var(--dusk);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--seam));
    animation: deal 0.42s cubic-bezier(0.2, 0.9, 0.25, 1.15);
    transform-origin: 50% 120%;
  }

  @keyframes deal {
    from {
      transform: translateY(18px) rotate(-2.5deg) scale(0.97);
      opacity: 0;
    }
  }

  .card.empty {
    animation: none;
    border-style: dashed;
    border-color: var(--seam);
    background: transparent;
  }

  .who {
    font-family: var(--display);
    font-size: clamp(2.3rem, 11vw, 4rem);
    font-weight: 800;
    font-stretch: 85%;
    letter-spacing: -0.04em;
    line-height: 0.95;
    word-break: break-word;
    text-align: left;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
  }

  .who.dim {
    color: var(--faint);
    font-size: clamp(1.9rem, 8vw, 2.8rem);
    cursor: default;
  }

  .what {
    font-family: var(--display);
    font-size: clamp(1.35rem, 5.4vw, 1.9rem);
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.2;
    text-align: left;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    display: -webkit-box;
    -webkit-line-clamp: 7;
    line-clamp: 7;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }

  .caption {
    margin-top: -6px;
    color: var(--mist);
    line-height: 1.45;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card.del .who,
  .card.del .what {
    color: var(--faint);
  }

  .stamp-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  /* A library date-due stamp. */
  .stamp {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    padding: 5px 12px 6px;
    border: 2px solid var(--accent);
    border-radius: 6px;
    color: var(--accent);
    transform: rotate(-3deg);
    font-weight: 700;
  }

  .stamp-k {
    font-size: 0.78rem;
    opacity: 0.85;
  }

  .stamp-v {
    font-family: var(--display);
    font-size: 1.05rem;
    letter-spacing: 0.01em;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    color: var(--mist);
  }

  .badge.fav {
    color: var(--gold);
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .actions .btn {
    padding: 0 10px;
  }

  .actions .btn[aria-pressed='true']:not(.fav-on):not(.del-on) {
    border-color: var(--accent);
  }

  .fav-on {
    background: var(--gold);
    border-color: transparent;
    color: #2a2000;
  }

  .del-on {
    background: #4a3550;
  }

  /* Small phones: stack the label under the icon instead of hiding it. */
  @media (max-width: 420px) {
    .actions .btn {
      flex-direction: column;
      gap: 2px;
      min-height: 58px;
      font-size: 0.74rem;
    }
  }

  .otd {
    display: grid;
    gap: 8px;
    margin-top: 12px;
  }

  .otd ul {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid var(--seam);
  }

  .keys {
    display: none;
  }

  @media (hover: hover) and (min-width: 720px) {
    .keys {
      display: block;
    }
  }

  kbd {
    display: inline-block;
    min-width: 1.6em;
    padding: 0 4px;
    border: 1px solid var(--seam);
    border-bottom-width: 2px;
    border-radius: 5px;
    text-align: center;
    font-family: var(--body);
    font-size: 0.8rem;
    color: var(--paper);
  }

  /* Draw button sits just above the tab bar on phones, within thumb reach. */
  .draw-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(var(--nav-h) + env(safe-area-inset-bottom));
    z-index: 20;
    padding: 10px 16px 12px;
    background: var(--night);
    box-shadow: 0 -10px 16px var(--night);
  }

  .bar-inner {
    display: grid;
    gap: 10px;
    max-width: var(--content);
    margin: 0 auto;
  }

  .bar-inner.two {
    grid-template-columns: 2fr 3fr;
  }

  .bar-inner .btn {
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.35);
  }

  .open {
    border-color: color-mix(in srgb, var(--accent) 55%, var(--seam));
    color: var(--accent);
  }

  /* ── preview mode: slim header + fitted preview ── */
  .random.previewing {
    gap: 10px;
  }

  .mini {
    display: grid;
    gap: 6px;
    animation: deal 0.3s cubic-bezier(0.2, 0.9, 0.25, 1.15);
  }

  .mini-top {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .mini-who {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 2px;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .mini-name {
    font-family: var(--display);
    font-size: 1.35rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mini-name.tweet {
    font-size: 1.02rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .mini.del .mini-name {
    color: var(--faint);
  }

  .mini-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    font-size: 0.82rem;
    color: var(--accent);
  }

  .mini-meta .badge {
    font-size: 0.8rem;
  }

  .mini-actions {
    display: flex;
    flex: none;
  }

  .mini-actions :global(.on-preview) {
    color: var(--accent);
  }

  .mini-caption {
    color: var(--mist);
    font-size: 0.9rem;
    line-height: 1.4;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* The extra space below keeps whatever comes next out of sight behind the bottom bar until you scroll. */
  .fit-slot {
    min-height: 280px;
    margin-bottom: 120px;
  }

  @media (min-width: 900px) {
    .draw-bar {
      left: 220px;
      bottom: 0;
    }
  }
</style>
