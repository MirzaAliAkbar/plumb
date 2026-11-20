import type { DocumentAnalysis, Line, PageAnalysis } from './types';
import type { ExtractedDocument } from './extract';
import { clusterLines } from './lines';
import { detectLayout, findRunningElements, runningKey } from './layout';
import { sequenceBlocks } from './sequence';

/**
 * The whole pipeline, as a pure function of extracted geometry.
 *
 * Pure on purpose: this is the part that has to be correct, so it must be
 * testable without a browser, a PDF, or a DOM.
 */
export function analyseDocument(extracted: ExtractedDocument): DocumentAnalysis {
  const pagesLines: Line[][] = extracted.pages.map((p) => clusterLines(p.runs));

  // Running headers/footers can only be found by looking across pages.
  const repeated = findRunningElements(
    pagesLines,
    extracted.pages[0]?.height ?? 792,
  );

  const bodySize = estimateBodySize(pagesLines);

  const pages: PageAnalysis[] = extracted.pages.map((page, i) => {
    const allLines = pagesLines[i];
    const kept: Line[] = [];
    const suppressed: Line[] = [];

    for (const line of allLines) {
      if (repeated.has(runningKey(line))) suppressed.push(line);
      else kept.push(line);
    }

    const layout = detectLayout(kept, page.width);
    const blocks = sequenceBlocks(kept, layout, { bodySize });

    const confidence = aggregateConfidence(blocks, layout.confidence);

    return {
      pageIndex: page.pageIndex,
      width: page.width,
      height: page.height,
      columns: layout.columns,
      blocks,
      suppressed,
      confidence,
    };
  });

  return {
    fileName: extracted.fileName,
    pageCount: extracted.pages.length,
    pages,
    confidence: aggregateConfidence(
      pages.flatMap((p) => p.blocks),
      1,
    ),
  };
}

/**
 * Estimate the body text size as the character-weighted mode of line sizes.
 * Headings are short, body text is long, so weighting by characters avoids
 * mistaking a big title for the body size.
 */
export function estimateBodySize(pagesLines: Line[][]): number {
  const weight = new Map<number, number>();
  for (const lines of pagesLines) {
    for (const line of lines) {
      const key = Math.round(line.size * 2) / 2;
      weight.set(key, (weight.get(key) ?? 0) + line.text.length);
    }
  }
  let best = 10;
  let bestWeight = -1;
  for (const [size, w] of weight) {
    if (w > bestWeight) {
      best = size;
      bestWeight = w;
    }
  }
  return best || 10;
}

function aggregateConfidence(
  blocks: { confidence: number }[],
  layoutConfidence: number,
): number {
  if (blocks.length === 0) return 0;
  const mean = blocks.reduce((a, b) => a + b.confidence, 0) / blocks.length;
  return Math.max(0, Math.min(1, mean * layoutConfidence));
}
