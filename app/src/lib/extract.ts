import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { TextRun } from './types';

// pdf.js needs its worker and its auxiliary data. Vite resolves the worker URL
// at build time and emits it as an asset, which is what keeps the app offline.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * pdf.js's auxiliary data, served from `/pdfjs/` (see vite.config.ts).
 *
 * These are not optional. Without CMaps, CJK text decodes to garbage; without
 * the standard font data, any PDF using a non-embedded Helvetica or Times loses
 * its glyph metrics; without the wasm codecs, JBIG2 and JPEG-2000 images fail to
 * decode. The app is served from a subpath on some hosts, so the URLs are
 * resolved against Vite's base rather than hard-coded absolute.
 */
const dataUrl = (dir: string) =>
  new URL(`pdfjs/${dir}/`, location.origin + import.meta.env.BASE_URL).href;

const DATA = {
  cMapUrl: dataUrl('cmaps'),
  cMapPacked: true,
  standardFontDataUrl: dataUrl('standard_fonts'),
  wasmUrl: dataUrl('wasm'),
  iccUrl: dataUrl('iccs'),
} as const;

export interface ExtractedPage {
  pageIndex: number;
  width: number;
  height: number;
  runs: TextRun[];
}

export interface ExtractedDocument {
  fileName: string;
  pageCount: number;
  pages: ExtractedPage[];
}

/** Why a document could not be opened, in terms the user can act on. */
export type OpenFailure =
  | { kind: 'password'; wrong: boolean }
  | { kind: 'invalid' }
  | { kind: 'corrupt' }
  | { kind: 'unsupported' }
  | { kind: 'unknown'; detail: string };

export class PdfOpenError extends Error {
  readonly failure: OpenFailure;

  constructor(failure: OpenFailure) {
    super(failure.kind);
    this.name = 'PdfOpenError';
    this.failure = failure;
  }
}

/**
 * Classify a pdf.js exception.
 *
 * The old code collapsed every failure into "it may be password-protected or
 * damaged", which is why a real password-protected file and a file that was not
 * a PDF at all produced the same unhelpful sentence. These are different
 * problems with different fixes, so they get different messages.
 */
export function classifyOpenError(err: unknown): OpenFailure {
  const name = (err as { name?: string })?.name ?? '';
  const message = String((err as { message?: string })?.message ?? '');

  if (name === 'PasswordException' || /password/i.test(message)) {
    // pdf.js reports "No password given" and "Incorrect Password" distinctly.
    const wrong = /incorrect/i.test(message);
    return { kind: 'password', wrong };
  }
  if (name === 'InvalidPDFException' || /invalid pdf/i.test(message)) {
    return { kind: 'invalid' };
  }
  if (name === 'MissingPDFException') {
    return { kind: 'corrupt' };
  }
  if (name === 'UnexpectedResponseException') {
    return { kind: 'unsupported' };
  }
  if (/standardFontDataUrl|cMapUrl|wasmUrl/i.test(message)) {
    // A missing data file is a deployment fault, not a problem with the file.
    return { kind: 'unsupported' };
  }
  return { kind: 'unknown', detail: message || name || 'Unknown error' };
}

/**
 * Open a document, asking for a password when one is needed.
 *
 * pdf.js calls `onPassword` from inside its own loading task; the promise it
 * returns does not settle until a password is supplied or the attempt is
 * cancelled. `requestPassword` therefore has to be a real prompt that the user
 * can answer, and can reject to abandon the open.
 */
export async function loadDocument(
  file: File,
  requestPassword?: (wrong: boolean) => Promise<string>,
): Promise<PDFDocumentProxy> {
  const task = await loadDocumentTask(file, requestPassword);
  return task.promise;
}

/**
 * The loading task, for callers that need to release the worker as well as the
 * document. `PDFDocumentProxy` only exposes `cleanup()`; `destroy()` lives on
 * the task, which is what actually terminates pdf.js's worker.
 */
export async function loadDocumentTask(
  file: File,
  requestPassword?: (wrong: boolean) => Promise<string>,
) {
  const data = new Uint8Array(await file.arrayBuffer());

  const task = pdfjs.getDocument({
    data,
    ...DATA,
    // Keep everything local: no font fetching from a CDN, no network at all.
    useSystemFonts: false,
  });

  let passwordAttempts = 0;
  task.onPassword = (updatePassword: (pw: string) => void, reason: number) => {
    const wrong = reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD;
    // No prompter, or the user keeps failing: abandon rather than loop forever.
    if (!requestPassword || passwordAttempts >= 3) {
      task.destroy();
      return;
    }
    passwordAttempts += 1;
    requestPassword(wrong).then(updatePassword, () => task.destroy());
  };

  try {
    await task.promise;
    return task;
  } catch (err) {
    await task.destroy();
    throw new PdfOpenError(classifyOpenError(err));
  }
}

export async function extractPage(page: PDFPageProxy, pageIndex: number): Promise<ExtractedPage> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  const runs: TextRun[] = [];
  for (const [stream, item] of content.items.entries()) {
    if (!('str' in item)) continue;
    const str = item.str;
    if (!str || !str.trim()) continue;

    // transform is [a, b, c, d, e, f]; e/f are the translation.
    const [, , , d, e, f] = item.transform as number[];
    const size = Math.abs(d) || Math.abs(item.height) || 10;
    const width = item.width || str.length * size * 0.5;

    runs.push({
      str,
      // Keep where the run sat in the file. This is the order a screen reader
      // receives when it ignores structure, and the comparison view shows it
      // beside the order we reconstruct.
      stream,
      // pdf.js y grows upward from the bottom; we flip so y grows downward,
      // which matches how every downstream rule reasons about "top of page".
      y: viewport.height - f,
      x: e,
      w: width,
      h: Math.abs(item.height) || size,
      font: item.fontName || '',
      size,
    });
  }

  return {
    pageIndex,
    width: viewport.width,
    height: viewport.height,
    runs,
  };
}

export async function extractDocument(
  file: File,
  onProgress?: (done: number, total: number) => void,
  requestPassword?: (wrong: boolean) => Promise<string>,
): Promise<ExtractedDocument> {
  const doc = await loadDocument(file, requestPassword);
  const pages: ExtractedPage[] = [];

  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      pages.push(await extractPage(page, i - 1));
      onProgress?.(i, doc.numPages);
      // Yield so the UI can paint progress rather than freezing.
      await new Promise((r) => setTimeout(r, 0));
    }
  } catch (err) {
    // A failure mid-document is a damaged file, not a password problem.
    throw new PdfOpenError(classifyOpenError(err));
  } finally {
    // `cleanup` releases page caches; `destroy` lives on the loading task, not
    // the document proxy, in pdf.js 6.x.
    await doc.cleanup();
  }

  return { fileName: file.name, pageCount: pages.length, pages };
}
