# Vault (web)

A local-first web app for browsing what you saved on Instagram and liked on X. Export files are parsed in the browser and stored in IndexedDB. Nothing is uploaded, except marker sync if you turn on the optional GitHub Gist sync.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # parser tests (also checks ../saved_posts.csv if present)
npm run check      # svelte-check + tsc
npm run build      # static site in dist/
```

`dist/` uses relative paths, so it can be served from any static host (Cloudflare Pages, Netlify, GitHub Pages) or a sub-path. To install it as an app on a phone, open the hosted URL and choose "Add to Home screen".

## Google Drive sync (optional)

Favourites and gone marks can sync through a hidden app folder in the user's own Google Drive ( scope, which Google treats as non-sensitive). To turn it on:

1. In Google Cloud Console, create an OAuth client of type **Web application**.
2. Add the site's origin under **Authorized JavaScript origins** and its full URL (with trailing slash) under **Authorized redirect URIs**, e.g.  and . Add  /  for local dev.
3. Put the client id in  as  (see ), and in the repo's Actions variable  for deploys.

Without a client id the Drive option is simply hidden.

## What it reads

| Source | Files |
|---|---|
| Instagram | export `.zip` (JSON format), `saved_posts.json`, or the old `saved_posts.csv` |
| X | archive `.zip`, or `data/like.js` (`like-part1.js`, … are supported) |

## Layout

- `src/lib/parse/`: export parsers. Old Streamlit row ids are recorded as `legacyIds` so old marker files can be migrated.
- `src/lib/vault.svelte.ts`: items + markers state, IndexedDB persistence, cached indexes.
- `src/lib/sync.ts`: backup/restore, old-marker migration, Gist sync.
- `src/pages/`: Random, Browse (Timeline/Search), People (Creators/Tags), Marked, Stats, Settings, Import.
