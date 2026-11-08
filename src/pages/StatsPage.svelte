<script lang="ts">
  import { vault, creatorCounts, hashtagCounts, mentionCounts, dateBounds } from '../lib/vault.svelte';
  import { router } from '../lib/router.svelte';
  import { fmtDate, fmtMonth, fmtNum } from '../lib/text';
  import BarChart from '../components/BarChart.svelte';

  let source = $derived(vault.source);
  let items = $derived(vault.list);
  let isIG = $derived(source === 'instagram');
  let bounds = $derived(dateBounds(items));
  let creators = $derived(isIG ? creatorCounts(items) : []);
  let tags = $derived(isIG ? [] : hashtagCounts(items));
  let ments = $derived(isIG ? [] : mentionCounts(items));
  let favs = $derived(vault.count(source, 'fav'));
  let dels = $derived(vault.count(source, 'del'));

  /** Count per calendar month, filling empty months so the time axis is honest. */
  let monthly = $derived.by(() => {
    if (!bounds) return [];
    const counts = new Map<string, number>();
    for (const it of items) {
      if (!it.savedAt) continue;
      const d = new Date(it.savedAt);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const out: { label: string; value: number }[] = [];
    const start = new Date(bounds.min);
    const end = new Date(bounds.max);
    for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d.setMonth(d.getMonth() + 1)) {
      out.push({ label: fmtMonth(d.getTime()), value: counts.get(`${d.getFullYear()}-${d.getMonth()}`) ?? 0 });
    }
    return out;
  });

  let busiest = $derived(monthly.reduce((a, b) => (b.value > a.value ? b : a), { label: '', value: 0 }));

  let lengths = $derived.by(() => {
    if (isIG) return [];
    const bins: [string, number, number][] = [
      ['Under 50', 0, 50],
      ['50 to 100', 50, 100],
      ['100 to 150', 100, 150],
      ['150 to 200', 150, 200],
      ['200 to 280', 200, 280],
      ['280 to 500', 280, 500],
      ['500 and up', 500, Infinity],
    ];
    const counts = bins.map(() => 0);
    for (const it of items) {
      const n = it.text.length;
      const i = bins.findIndex(([, lo, hi]) => n > lo && n <= hi);
      if (i >= 0) counts[i]++;
    }
    return bins.map(([label], i) => ({ label, value: counts[i] }));
  });
</script>

<div class="stack stats">
  <h1>{isIG ? 'Your saves' : 'Your likes'}</h1>

  {#if bounds}
    <p class="lede">
      <span class="big num">{fmtNum(items.length)}</span>
      {isIG ? 'posts saved' : 'tweets liked'}
      {#if isIG}from <strong class="num">{fmtNum(creators.length)}</strong> creators{/if}, {isIG ? 'between' : 'posted between'}
      <strong>{fmtDate(bounds.min)}</strong> and <strong>{fmtDate(bounds.max)}</strong>.
    </p>
  {/if}

  <dl class="facts">
    {#if isIG && creators.length}
      <div>
        <dt>Top creator</dt>
        <dd><button class="linkish" onclick={() => router.go('people', creators[0][0])}>@{creators[0][0]}</button></dd>
        <dd class="muted small num">{fmtNum(creators[0][1])} saves</dd>
      </div>
    {/if}
    {#if !isIG}
      <div>
        <dt>Unique hashtags</dt>
        <dd class="num">{fmtNum(tags.length)}</dd>
      </div>
    {/if}
    {#if busiest.value}
      <div>
        <dt>Busiest month</dt>
        <dd>{busiest.label}</dd>
        <dd class="muted small num">{fmtNum(busiest.value)} {isIG ? 'saves' : 'tweets'}</dd>
      </div>
    {/if}
    <div>
      <dt>Favourites</dt>
      <dd class="num">{fmtNum(favs)}</dd>
    </div>
    <div>
      <dt>Probably deleted</dt>
      <dd class="num">{fmtNum(dels)}</dd>
    </div>
  </dl>

  {#if monthly.length > 1}
    <section class="panel">
      <BarChart
        title={isIG ? 'Saves per month' : 'Liked tweets by month posted'}
        data={monthly}
        orientation="v"
        unit={isIG ? 'saves' : 'tweets'}
      />
    </section>
  {/if}

  {#if isIG && creators.length}
    <section class="panel">
      <BarChart
        title="Top 25 creators"
        data={creators.slice(0, 25).map(([label, value]) => ({ label: '@' + label, value }))}
        onSelect={(l) => router.go('people', l.slice(1))}
        unit="saves"
      />
    </section>
  {/if}

  {#if !isIG}
    {#if tags.length}
      <section class="panel">
        <BarChart
          title="Top 20 hashtags"
          data={tags.slice(0, 20).map(([label, value]) => ({ label: '#' + label, value }))}
          onSelect={(l) => router.go('people', l)}
          unit="tweets"
        />
      </section>
    {/if}
    {#if ments.length}
      <section class="panel">
        <BarChart
          title="Top 20 mentions"
          data={ments.slice(0, 20).map(([label, value]) => ({ label: '@' + label, value }))}
          onSelect={(l) => router.go('people', l)}
          unit="tweets"
        />
      </section>
    {/if}
    <section class="panel">
      <BarChart title="Tweet length (characters)" data={lengths} unit="tweets" />
    </section>
  {/if}

  <p class="muted small">Clear favourites or deleted marks from the Marked tab.</p>
</div>

<style>
  .lede {
    font-size: 1.15rem;
    color: var(--mist);
    max-width: 40ch;
    line-height: 1.5;
  }

  .lede strong {
    color: var(--paper);
  }

  .big {
    display: block;
    font-family: var(--display);
    font-size: clamp(3.2rem, 15vw, 5rem);
    font-weight: 800;
    letter-spacing: -0.05em;
    line-height: 0.95;
    color: var(--paper);
  }

  .facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1px;
    margin: 0;
    border: 1px solid var(--seam);
    border-radius: 16px;
    overflow: hidden;
    background: var(--seam);
  }

  .facts div {
    padding: 14px 16px;
    background: var(--night);
  }

  dt {
    font-size: 0.82rem;
    color: var(--mist);
  }

  dd {
    margin: 2px 0 0;
    font-family: var(--display);
    font-size: 1.3rem;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  dd.small {
    font-family: var(--body);
    font-size: 0.85rem;
    font-weight: 400;
  }

  .linkish {
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: var(--accent);
    text-underline-offset: 4px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
