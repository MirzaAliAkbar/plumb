import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadDocumentTask } from './extract';

/**
 * Rasterise a page so the overlay can sit on the real document rather than on a
 * blank rectangle.
 *
 * The bitmap is generated on demand and held in memory only. It is not part of
 * `DocumentAnalysis`, because a data URL per page would multiply the size of
 * every saved document in IndexedDB for something that can be redrawn in a few
 * milliseconds from the original file.
 */

/** Cap the rendered width: 1400px is sharp on a 2x laptop and bounded on a 4K one. */
const MAX_WIDTH = 1400;

export interface RenderedPage {
  dataUrl: string;
  /** CSS pixels per PDF point, used to map run coordinates onto the image. */
  scale: number;
}

export async function renderPage(
  doc: PDFDocumentProxy,
  pageIndex: number,
): Promise<RenderedPage> {
  const page = await doc.getPage(pageIndex + 1);
  const base = page.getViewport({ scale: 1 });
  // 1.5x is sharp enough to read the page behind the outlines, and keeps the
  // PNG small enough that switching pages stays responsive.
  const scale = Math.min(1.5, MAX_WIDTH / base.width);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('This browser cannot draw the page preview.');

  // Paint the paper colour explicitly: a transparent PNG behind dark-mode CSS
  // would show the app background through the document.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvas, canvasContext: context, viewport }).promise;
  page.cleanup();

  return { dataUrl: canvas.toDataURL('image/png'), scale };
}

/**
 * Open a source blob and render one page.
 *
 * Kept as a single call so the caller does not have to manage the lifetime of a
 * pdf.js document just to draw a preview. `destroy` runs even when rendering
 * fails, so a broken page cannot leak the worker.
 */
export async function renderSourcePage(
  source: Blob,
  pageIndex: number,
): Promise<RenderedPage> {
  const file = new File([source], 'source.pdf', { type: 'application/pdf' });
  const task = await loadDocumentTask(file);
  try {
    const doc = await task.promise;
    return await renderPage(doc, pageIndex);
  } finally {
    await task.destroy();
  }
}

/** True when pdf.js can draw a page in this environment. */
export function canRenderPages(): boolean {
  return typeof document !== 'undefined' && !!document.createElement('canvas').getContext;
}
