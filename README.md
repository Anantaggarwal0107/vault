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

Favourites and gone marks can sync through a hidden app folder in the user's own Google Drive (`drive.appdata` scope, which Google treats as non-sensitive). To turn it on:

1. In Google Cloud Console, create an OAuth client of type **Web application**.
2. Add the site's origin under **Authorized JavaScript origins** and its full URL (with trailing slash) under **Authorized redirect URIs**, e.g. `https://anantaggarwal0107.github.io` and `https://anantaggarwal0107.github.io/vault/`. Add `http://localhost:5173` / `http://localhost:5173/` for local dev.
3. Put the client id in `.env.local` as `VITE_GOOGLE_CLIENT_ID` (see `.env.example`), and in the repo's Actions variable `GOOGLE_CLIENT_ID` for deploys.

Without a client id the Drive option is simply hidden.

## What it reads

| Source | Files |
|---|---|
| Instagram | export `.zip` (HTML or JSON, streamed so 400 MB+ exports work on phones), `saved_posts.html` / `.json`, or a `saved_posts.csv` |
| Vault copy | the zip from **Save a copy of everything** (posts, likes and favourites) |
| X | archive `.zip`, or `data/like.js` (`like-part1.js`, … are supported) |

## Layout

- `src/lib/parse/`: export parsers. Old Streamlit row ids are recorded as `legacyIds` so old marker files can be migrated.
- `src/lib/vault.svelte.ts`: items + markers state, IndexedDB persistence, cached indexes.
- `src/lib/drive.svelte.ts` + `src/lib/merge.ts`: Google Drive sync of favourites, merging devices (newest change per post wins).
- `src/lib/compact.ts`: "Save a copy of everything", a small zip (posts CSV with captions, like.js, favourites) that Vault re-imports.
- `src/lib/sync.ts`: favourites files and moving favourites from the old Streamlit apps (by row number).
- `src/pages/`: Random, Browse (Timeline/Search), People (Creators/Tags), Marked, Stats, Settings, Import.
