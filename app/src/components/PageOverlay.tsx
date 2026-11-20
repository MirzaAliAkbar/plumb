import type { Block, PageAnalysis } from '../lib/types';
import { joinLines } from '../lib/lines';
import './PageOverlay.css';

export interface PageOverlayProps {
  page: PageAnalysis;
  activeOrder?: number | null;
  onActivate?: (order: number) => void;
}

function bounds(block: Block) {
  const lines = block.lines;
  if (!lines.length) return null;
  const x0 = Math.min(...lines.map((l) => l.x0));
  const x1 = Math.max(...lines.map((l) => l.x1));
  const size = lines[0].size || 10;
  const yTop = Math.min(...lines.map((l) => l.y)) - size * 0.85;
  const yBottom = Math.max(...lines.map((l) => l.y)) + size * 0.35;
  return { x0, x1, yTop, yBottom };
}

function level(c: number): 'high' | 'medium' | 'low' {
  if (c >= 0.8) return 'high';
  if (c >= 0.6) return 'medium';
  return 'low';
}

/** Stroke pattern encodes confidence independently of colour. */
const DASH: Record<string, string | undefined> = {
  high: undefined,
  medium: '7 5',
  low: '2 5',
};

const KIND_LABEL: Record<Block['kind'], string> = {
  heading: 'Heading',
  paragraph: 'Paragraph',
  'list-item': 'List item',
  caption: 'Figure caption',
  code: 'Code',
  'table-text': 'Table text',
};

/**
 * The numbered overlay: what a screen reader gets, made visible.
 *
 * This is the piece that makes the problem legible in two seconds — the numbers
 * run in scrambled order, then in correct order. It is also a real tool: each
 * block is focusable so a keyboard user can walk the order.
 */
export function PageOverlay({ page, activeOrder, onActivate }: PageOverlayProps) {
  if (!page.blocks.length) {
    return (
      <p className="overlay-empty">
        No text found on this page. It may be a scanned image — those need OCR,
        which Plumb does not do.
      </p>
    );
  }

  return (
    <figure className="overlay">
      <div className="overlay__frame">
        <svg
          className="overlay__svg"
          viewBox={`0 0 ${page.width} ${page.height}`}
          role="group"
          aria-label={`Reading order for page ${page.pageIndex + 1}: ${page.blocks.length} text blocks`}
          preserveAspectRatio="xMidYMin meet"
        >
          <rect x="0" y="0" width={page.width} height={page.height} className="overlay__paper" />

          {page.suppressed.map((line, i) => (
            <line
              key={`s${i}`}
              x1={line.x0}
              x2={line.x1}
              y1={line.y}
              y2={line.y}
              className="overlay__suppressed"
              aria-hidden="true"
            />
          ))}

          {page.blocks.map((block) => {
            const b = bounds(block);
            if (!b) return null;
            const lv = level(block.confidence);
            const active = activeOrder === block.order;
            const label = `${b.x0},${b.yTop},${b.x1 - b.x0},${b.yBottom - b.yTop}`;
            const [x, y, w, h] = label.split(',').map(Number);

            return (
              <g
                key={block.order}
                className={`overlay__block overlay__block--${lv}${active ? ' overlay__block--active' : ''}`}
                tabIndex={0}
                role="button"
                aria-label={`Block ${block.order}, ${KIND_LABEL[block.kind]}, ${
                  Math.round(block.confidence * 100)
                }% confidence${active ? ', currently selected' : ''}`}
                aria-pressed={active}
                onClick={() => onActivate?.(block.order)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onActivate?.(block.order);
                  }
                }}
              >
                <rect
                  x={x}
                  y={y}
                  width={Math.max(w, 2)}
                  height={Math.max(h, 2)}
                  rx="3"
                  className="overlay__rect"
                  strokeDasharray={DASH[lv]}
                  vectorEffect="non-scaling-stroke"
                />
                {/* Invisible hit area: text blocks are only ~16pt tall, which is
                    below the 24px target minimum for a focusable control. */}
                <rect
                  x={x - 4}
                  y={y - (Math.max(h, 34) - h) / 2}
                  width={Math.max(w + 8, 34)}
                  height={Math.max(h, 34)}
                  className="overlay__hit"
                />
                <circle cx={x + 9} cy={y + 9} r="8.5" className="overlay__badge" />
                <text x={x + 9} y={y + 12.5} className="overlay__number" textAnchor="middle">
                  {block.order}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <figcaption className="overlay__legend">
        <span className="overlay__legend-item">
          <span className="overlay__swatch overlay__swatch--high" aria-hidden="true" />
          solid — confident
        </span>
        <span className="overlay__legend-item">
          <span className="overlay__swatch overlay__swatch--medium" aria-hidden="true" />
          dashed — fairly sure
        </span>
        <span className="overlay__legend-item">
          <span className="overlay__swatch overlay__swatch--low" aria-hidden="true" />
          dotted — unsure
        </span>
        {page.suppressed.length > 0 && (
          <span className="overlay__legend-item overlay__legend-item--muted">
            {page.suppressed.length} header/footer line
            {page.suppressed.length === 1 ? '' : 's'} removed
          </span>
        )}
      </figcaption>

      {/* The same information, in the order a screen reader will hear it. */}
      <div className="visually-hidden">
        <h3>Reading order detail</h3>
        <ol>
          {page.blocks.map((block) => (
            <li key={block.order}>
              {KIND_LABEL[block.kind]}, {Math.round(block.confidence * 100)} percent
              confidence: {joinLines(block.lines).slice(0, 160)}
              {block.warning ? `. Note: ${block.warning}` : ''}
            </li>
          ))}
        </ol>
      </div>
    </figure>
  );
}
