import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { TextRun } from './types';

// pdf.js needs its worker and standard fonts. Vite resolves these URLs at build
// time and emits them as assets, which is what keeps the app fully offline.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

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

export async function loadDocument(file: File): Promise<PDFDocumentProxy> {
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjs.getDocument({
    data,
    // Keep everything local: no font fetching, no network.
    useSystemFonts: false,
  }).promise;
}

export async function extractPage(page: PDFPageProxy, pageIndex: number): Promise<ExtractedPage> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  const runs: TextRun[] = [];
  for (const item of content.items) {
    if (!('str' in item)) continue;
    const str = item.str;
    if (!str || !str.trim()) continue;

    // transform is [a, b, c, d, e, f]; e/f are the translation.
    const [, , , d, e, f] = item.transform as number[];
    const size = Math.abs(d) || Math.abs(item.height) || 10;
    const width = item.width || str.length * size * 0.5;

    runs.push({
      str,
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
): Promise<ExtractedDocument> {
  const doc = await loadDocument(file);
  const pages: ExtractedPage[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    pages.push(await extractPage(page, i - 1));
    onProgress?.(i, doc.numPages);
    // Yield so the UI can paint progress rather than freezing.
    await new Promise((r) => setTimeout(r, 0));
  }

  // `cleanup` releases page caches; `destroy` lives on the loading task, not the
  // document proxy, in pdf.js 6.x.
  await doc.cleanup();

  return { fileName: file.name, pageCount: pages.length, pages };
}
