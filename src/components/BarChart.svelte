<script lang="ts">
  import { fmtNum } from '../lib/text';

  interface Datum {
    label: string;
    value: number;
  }

  let {
    data,
    title,
    orientation = 'h',
    onSelect,
    unit = 'posts',
  }: {
    data: Datum[];
    title: string;
    orientation?: 'h' | 'v';
    onSelect?: (label: string) => void;
    unit?: string;
  } = $props();

  let max = $derived(Math.max(1, ...data.map((d) => d.value)));
  let hover = $state<number | null>(null);
  let showTable = $state(false);

  function niceTicks(m: number): number[] {
    const step = Math.pow(10, Math.floor(Math.log10(m)));
    const s = m / step > 5 ? step * 2 : m / step > 2 ? step : step / 2;
    const ticks = [];
    for (let v = 0; v <= m; v += Math.max(1, s)) ticks.push(v);
    return ticks;
  }
  let ticks = $derived(niceTicks(max));
  let top = $derived(ticks[ticks.length - 1] < max ? max : ticks[ticks.length - 1]);

  // Vertical columns: label every nth so they never collide.
  let labelEvery = $derived(Math.max(1, Math.ceil(data.length / 8)));
</script>

<figure class="chart">
  <figcaption>
    <h3>{title}</h3>
    <button class="link small" onclick={() => (showTable = !showTable)}>{showTable ? 'Show chart' : 'Show as table'}</button>
  </figcaption>

  {#if showTable}
    <table>
      <thead><tr><th scope="col">Label</th><th scope="col" class="r">{unit}</th></tr></thead>
      <tbody>
        {#each data as d (d.label)}<tr><td>{d.label}</td><td class="r num">{fmtNum(d.value)}</td></tr>{/each}
      </tbody>
    </table>
  {:else if orientation === 'h'}
    <ol class="hbars">
      {#each data as d, i (d.label)}
        <li>
          <svelte:element
            this={onSelect ? 'button' : 'div'}
            class="hrow"
            role={onSelect ? undefined : 'presentation'}
            onclick={onSelect ? () => onSelect(d.label) : undefined}
            onmouseenter={() => (hover = i)}
            onmouseleave={() => (hover = null)}
          >
            <span class="hlabel">{d.label}</span>
            <span class="track"><span class="bar" style:width="{(d.value / max) * 100}%"></span></span>
            <span class="hval num">{fmtNum(d.value)}</span>
          </svelte:element>
        </li>
      {/each}
    </ol>
  {:else}
    <div class="vwrap">
      <div class="grid" aria-hidden="true">
        {#each ticks as t (t)}
          <div class="tick" style:bottom="{(t / top) * 100}%"><span class="num">{fmtNum(t)}</span></div>
        {/each}
      </div>
      <div class="cols">
        {#each data as d, i (d.label)}
          <button
            type="button"
            class="col"
            aria-label="{d.label}: {fmtNum(d.value)} {unit}"
            onmouseenter={() => (hover = i)}
            onmouseleave={() => (hover = null)}
            onfocus={() => (hover = i)}
            onblur={() => (hover = null)}
            onclick={() => (hover = hover === i ? null : i)}
          >
            <div class="vbar" class:hot={hover === i} style:height="{(d.value / top) * 100}%"></div>
            {#if hover === i}
              <div class="tip" class:right={i > data.length * 0.7} style:bottom="calc({(d.value / top) * 100}% + 6px)">
                <strong>{d.label}</strong><span class="num">{fmtNum(d.value)} {unit}</span>
              </div>
            {/if}
          </button>
        {/each}
      </div>
      <div class="xlabels" aria-hidden="true">
        {#each data as d, i (d.label)}
          <span>{i % labelEvery === 0 ? d.label : ''}</span>
        {/each}
      </div>
    </div>
  {/if}
</figure>

<style>
  .chart {
    margin: 0;
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  figcaption {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .link {
    border: none;
    background: none;
    color: var(--mist);
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
    padding: 4px 0;
  }

  /* horizontal bars */
  .hbars {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }

  .hrow {
    display: grid;
    grid-template-columns: minmax(80px, 34%) 1fr auto;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 32px;
    padding: 2px 6px;
    border: none;
    border-radius: 8px;
    background: none;
    text-align: left;
    color: var(--paper);
    font-size: 0.9rem;
  }

  button.hrow {
    cursor: pointer;
  }

  button.hrow:hover,
  .hrow:hover {
    background: var(--dusk-2);
  }

  .hlabel {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .track {
    height: 16px;
    display: flex;
  }

  .bar {
    display: block;
    min-width: 2px;
    background: var(--accent-mark);
    border-radius: 0 4px 4px 0;
  }

  .hval {
    color: var(--mist);
    min-width: 3ch;
    text-align: right;
  }

  /* vertical columns */
  .vwrap {
    position: relative;
    padding-left: 44px;
  }

  .grid {
    position: absolute;
    inset: 0 0 24px 44px;
    pointer-events: none;
  }

  .tick {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1px solid var(--seam);
  }

  .tick span {
    position: absolute;
    right: calc(100% + 8px);
    top: -0.6em;
    font-size: 0.72rem;
    color: var(--faint);
  }

  .cols {
    position: relative;
    min-width: 0;
    height: 200px;
    display: flex;
    align-items: flex-end;
    gap: 2px;
  }

  .col {
    position: relative;
    flex: 1;
    min-width: 0;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    height: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .vbar {
    width: 100%;
    max-width: 24px;
    min-height: 1px;
    background: var(--accent-mark);
    border-radius: 4px 4px 0 0;
  }

  .vbar.hot {
    background: var(--accent);
  }

  .tip {
    position: absolute;
    left: 50%;
    transform: translateX(-30%);
    z-index: 2;
    display: grid;
    gap: 2px;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--paper);
    color: var(--night);
    font-size: 0.8rem;
    white-space: nowrap;
    pointer-events: none;
  }

  .tip.right {
    transform: translateX(-85%);
  }

  .xlabels {
    display: flex;
    overflow: hidden;
    gap: 2px;
    height: 24px;
    padding-top: 6px;
    font-size: 0.72rem;
    color: var(--faint);
  }

  .xlabels span {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: visible;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  th,
  td {
    padding: 6px 4px;
    border-bottom: 1px solid var(--seam);
    text-align: left;
  }

  th {
    color: var(--mist);
    font-weight: 700;
  }

  .r {
    text-align: right;
  }
</style>
