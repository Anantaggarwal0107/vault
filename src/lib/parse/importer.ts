import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
import type { Item, Source } from '../types';
import { parseInstagramCsv, parseInstagramJson } from './instagram';
import { likesToItems, parseLikeJs } from './x';

export interface ImportResult {
  instagram: Item[] | null;
  x: Item[] | null;
  notes: string[];
}

const LIKE_FILE_RE = /(^|\/)like(?:-part(\d+))?\.js$/i;
const IG_SAVED_RE = /(^|\/)saved_posts\.json$/i;

function likePart(name: string): number {
  const m = name.match(LIKE_FILE_RE);
  return m?.[2] ? Number(m[2]) : 0;
}

/**
 * Read any mix of: Instagram export zip / saved_posts.json / saved_posts.csv,
 * X archive zip / like.js. Everything happens in the browser; nothing is uploaded.
 */
export async function readFiles(files: File[], onStatus?: (msg: string) => void): Promise<ImportResult> {
  const igParts: Item[][] = [];
  const likeFiles: { part: number; text: string }[] = [];
  const notes: string[] = [];

  for (const file of files) {
    const name = file.name.toLowerCase();
    onStatus?.(`Reading ${file.name}…`);
    if (name.endsWith('.zip')) {
      const reader = new ZipReader(new BlobReader(file));
      try {
        const entries = await reader.getEntries();
        let found = 0;
        for (const entry of entries) {
          if (entry.directory || !('getData' in entry) || !entry.getData) continue;
          if (LIKE_FILE_RE.test(entry.filename)) {
            likeFiles.push({ part: likePart(entry.filename), text: await entry.getData(new TextWriter()) });
            found++;
          } else if (IG_SAVED_RE.test(entry.filename)) {
            const text = await entry.getData(new TextWriter());
            igParts.push(parseInstagramJson(JSON.parse(text)));
            found++;
          }
        }
        if (!found) {
          notes.push(
            `${file.name}: no saved posts or likes found. For Instagram, make sure you chose JSON format when requesting the download.`,
          );
        }
      } finally {
        await reader.close();
      }
    } else if (name.endsWith('.csv')) {
      igParts.push(parseInstagramCsv(await file.text()));
    } else if (name.endsWith('.json')) {
      igParts.push(parseInstagramJson(JSON.parse(await file.text())));
    } else if (LIKE_FILE_RE.test(name)) {
      likeFiles.push({ part: likePart(name), text: await file.text() });
    } else {
      notes.push(`${file.name}: skipped. Expected a .zip, saved_posts.json, saved_posts.csv or like.js file.`);
    }
  }

  let instagram: Item[] | null = null;
  if (igParts.length) {
    const byKey = new Map<string, Item>();
    for (const part of igParts) for (const it of part) if (!byKey.has(it.key)) byKey.set(it.key, it);
    instagram = [...byKey.values()];
    if (!instagram.length) notes.push('No Instagram posts were found in the selected files.');
  }

  let x: Item[] | null = null;
  if (likeFiles.length) {
    likeFiles.sort((a, b) => a.part - b.part);
    x = likesToItems(likeFiles.flatMap((f) => parseLikeJs(f.text)));
  }

  return { instagram, x, notes };
}

export function countBySource(r: ImportResult): Partial<Record<Source, number>> {
  const out: Partial<Record<Source, number>> = {};
  if (r.instagram) out.instagram = r.instagram.length;
  if (r.x) out.x = r.x.length;
  return out;
}
