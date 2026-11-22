import { openDB, type IDBPDatabase } from 'idb';
import type { DocumentAnalysis } from './types';

/**
 * Where a document lives.
 *
 * Two stores, on purpose, because they answer different questions:
 *
 * - **IndexedDB** holds the analysis itself — every block, every line, every
 *   confidence score. It is large and it never leaves the device. That is the
 *   privacy promise the whole product rests on, and it is also just true: a
 *   20-page paper is several megabytes of geometry.
 *
 * - **Clerk `unsafeMetadata`** holds a small index: id, title, page count,
 *   confidence, and when it was opened. It syncs across devices, so the library
 *   follows the account rather than the browser.
 *
 * The index deliberately does *not* contain the document's text. A user's
 * account tells them which papers they have opened, never what is inside them.
 */

export interface DocumentRecord {
  /** Stable id, generated at save time. */
  id: string;
  fileName: string;
  pageCount: number;
  confidence: number;
  /** epoch milliseconds */
  savedAt: number;
}

const DB_NAME = 'plumb';
const DB_VERSION = 1;
const ANALYSIS_STORE = 'analyses';
const BLOB_STORE = 'sources';

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(ANALYSIS_STORE)) {
        database.createObjectStore(ANALYSIS_STORE);
      }
      if (!database.objectStoreNames.contains(BLOB_STORE)) {
        database.createObjectStore(BLOB_STORE);
      }
    },
  });
  return dbPromise;
}

/** Save the analysis (and the original bytes) for a document. */
export async function saveDocument(
  analysis: DocumentAnalysis,
  source: Blob,
  id = crypto.randomUUID(),
): Promise<DocumentRecord> {
  const database = await db();
  const record: DocumentRecord = {
    id,
    fileName: analysis.fileName,
    pageCount: analysis.pageCount,
    confidence: analysis.confidence,
    savedAt: Date.now(),
  };
  await database.put(ANALYSIS_STORE, analysis, id);
  await database.put(BLOB_STORE, source, id);
  return record;
}

export async function loadAnalysis(id: string): Promise<DocumentAnalysis | undefined> {
  return (await db()).get(ANALYSIS_STORE, id);
}

export async function loadSource(id: string): Promise<Blob | undefined> {
  return (await db()).get(BLOB_STORE, id);
}

export async function deleteDocument(id: string): Promise<void> {
  const database = await db();
  await database.delete(ANALYSIS_STORE, id);
  await database.delete(BLOB_STORE, id);
}

/** How many records the account index keeps before the oldest is dropped. */
export const LIBRARY_LIMIT = 40;

/**
 * Clerk metadata is capped at 8 KB for the whole object, and a single record is
 * roughly 110 bytes of JSON. Forty records sit comfortably inside that with room
 * for the user's other metadata; unbounded growth would eventually make every
 * save fail, which is a far worse failure than forgetting the oldest document.
 */
export function mergeRecord(
  existing: DocumentRecord[],
  record: DocumentRecord,
): DocumentRecord[] {
  const withoutDupe = existing.filter((r) => r.id !== record.id);
  return [record, ...withoutDupe]
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, LIBRARY_LIMIT);
}

/** Read the index out of a Clerk user's `unsafeMetadata`, defensively. */
export function readIndex(metadata: unknown): DocumentRecord[] {
  const raw = (metadata as { documents?: unknown } | null)?.documents;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).sort((a, b) => b.savedAt - a.savedAt);
}

function isRecord(v: unknown): v is DocumentRecord {
  const r = v as DocumentRecord;
  return (
    !!r &&
    typeof r.id === 'string' &&
    typeof r.fileName === 'string' &&
    typeof r.pageCount === 'number' &&
    typeof r.confidence === 'number' &&
    typeof r.savedAt === 'number'
  );
}

export function formatSavedAt(ms: number): string {
  const d = new Date(ms);
  const now = Date.now();
  const diff = now - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
