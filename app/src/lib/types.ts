/**
 * Core data model for the reading-order pipeline.
 *
 * Everything downstream of `extract` is pure: given runs, it produces analysis.
 * That is deliberate — it makes every stage unit-testable without a DOM or a PDF.
 */

/** A single text run as pdf.js reports it, normalised to page points. */
export interface TextRun {
  str: string;
  /** left edge */
  x: number;
  /** baseline y, measured from the top of the page (y grows downward) */
  y: number;
  w: number;
  h: number;
  font: string;
  size: number;
}

/** Runs clustered onto one visual baseline. */
export interface Line {
  runs: TextRun[];
  x0: number;
  x1: number;
  y: number;
  text: string;
  /** dominant font size on the line */
  size: number;
}

export type BlockKind =
  | 'heading'
  | 'paragraph'
  | 'list-item'
  | 'caption'
  | 'code'
  | 'table-text';

export interface Block {
  kind: BlockKind;
  lines: Line[];
  /** 1-based reading position on the page */
  order: number;
  /** 0..1 — how sure the pipeline is about this block's position and kind */
  confidence: number;
  /** which detected column the block belongs to (0 = left/first) */
  column: number;
  /** short human-readable reason for a low confidence, shown in the UI */
  warning?: string;
}

export interface PageAnalysis {
  pageIndex: number;
  width: number;
  height: number;
  /** detected column count for the body of the page */
  columns: number;
  blocks: Block[];
  /** lines judged to be running headers/footers/page numbers */
  suppressed: Line[];
  confidence: number;
}

export interface DocumentAnalysis {
  fileName: string;
  pageCount: number;
  pages: PageAnalysis[];
  /** mean of page confidences, weighted by block count */
  confidence: number;
}
