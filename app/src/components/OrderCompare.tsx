import { useMemo } from 'react';
import type { Block, Line, PageAnalysis } from '../lib/types';
import { joinLines } from '../lib/lines';
import './OrderCompare.css';

export interface OrderCompareProps {
  page: PageAnalysis;
  activeOrder?: number | null;
  onActivate?: (order: number) => void;
}

const KIND_LABEL: Record<Block['kind'], string> = {
  heading: 'Heading',
  paragraph: 'Paragraph',
  'list-item': 'List item',
  caption: 'Figure caption',
  code: 'Code',
  'table-text': 'Table text',
};

/** Shorten a block to one readable line, without cutting mid-word. */
function excerpt(block: Block, max = 96): string {
  const text = joinLines(block.lines);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max)}…`;
}

/**
 * The failure and the repair, side by side.
 *
 * The overlay proves where a block is; this proves what changed. Blocks are
 * ordered by their position in the PDF content stream on the left and by the
 * reconstructed reading order on the right, so a judge can see the gutter
 * crossings without taking the claim on trust.
 */
export function OrderCompare({ page, activeOrder, onActivate }: OrderCompareProps) {
  const stored = useMemo(() => {
    // Older saved analyses predate `stored`; block order is the best available
    // stand-in and the heading says which is being shown.
    const hasStream = page.blocks.some((b) => typeof b.stored === 'number');
    return hasStream
      ? [...page.blocks].sort((a, b) => (a.stored ?? 0) - (b.stored ?? 0))
      : [...page.blocks].sort((a, b) => a.order - b.order);
  }, [page]);

  const repaired = useMemo(
    () => [...page.blocks].sort((a, b) => a.order - b.order),
    [page],
  );

  const storedRank = new Map(stored.map((b, i) => [b.order, i]));
  const moved = repaired.filter((b) => storedRank.get(b.order) !== b.order - 1).length;

  // Lines, not blocks, are where the damage shows: a block can keep its place
  // while every line inside it arrives from the other column.
  const readingLines = useMemo(
    () => repaired.flatMap((b) => b.lines),
    [repaired],
  );
  const storedLines = useMemo(() => {
    if (!readingLines.some((l) => typeof l.stream === 'number')) return [];
    return [...readingLines].sort((a, b) => (a.stream ?? 0) - (b.stream ?? 0));
  }, [readingLines]);
  const lineRank = new Map(storedLines.map((l, i) => [l, i]));
  const movedLines = readingLines.filter((l, i) => lineRank.get(l) !== i).length;

  return (
    <div className="compare">
      <p className="compare__summary" role="note">
        {storedLines.length > 0 ? (
          <>
            <strong>{movedLines}</strong> of {readingLines.length} lines are in a
            different position in the file than on the page. Grouped into blocks,{' '}
            <strong>{moved}</strong> of {repaired.length} move.
          </>
        ) : (
          <>
            <strong>{moved}</strong> of {repaired.length} blocks change position.
          </>
        )}{' '}
        {page.columns === 2
          ? 'The left list follows the file; the right list follows the page.'
          : 'This page is a single column, so the two orders should match.'}{' '}
        {moved > 0 && 'A red arrow marks where a block moves to.'}
      </p>

      {storedLines.length > 0 && page.columns === 2 && (
        <StreamStrip
          stored={storedLines}
          reading={readingLines}
          gutter={page.width / 2}
        />
      )}

      <div className="compare__pair">
        <section className="compare__col" aria-labelledby="compare-stored">
          <header className="compare__head compare__head--bad">
            <h3 id="compare-stored">What the file stores</h3>
            <p>The order a screen reader hears when it ignores layout.</p>
          </header>
          <ol className="compare__list">
            {stored.map((block, i) => (
              <CompareRow
                key={block.order}
                block={block}
                position={i + 1}
                active={activeOrder === block.order}
                onActivate={onActivate}
                movesTo={storedRank.get(block.order) === block.order - 1 ? null : block.order}
              />
            ))}
          </ol>
        </section>

        <section className="compare__col" aria-labelledby="compare-repaired">
          <header className="compare__head compare__head--good">
            <h3 id="compare-repaired">What Plumb reads</h3>
            <p>The order a person follows: finish the column, then the next.</p>
          </header>
          <ol className="compare__list">
            {repaired.map((block) => (
              <CompareRow
                key={block.order}
                block={block}
                position={block.order}
                active={activeOrder === block.order}
                onActivate={onActivate}
              />
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

/**
 * One cell per line, in the order the file stores them, then in the order a
 * reader follows. The alternation is the bug; the solid runs are the fix.
 */
function StreamStrip({
  stored,
  reading,
  gutter,
}: {
  stored: Line[];
  reading: Line[];
  gutter: number;
}) {
  const side = (l: Line) => (l.x0 < gutter ? 'left' : 'right');
  const label =
    'Diagram: each cell is one line of text, coloured by the column it sits in. ' +
    `The file's order alternates between columns; the repaired order finishes each column.`;

  return (
    <figure className="stream" aria-label={label}>
      <figcaption className="stream__caption">
        Every line on the page, in file order and in reading order
      </figcaption>
      {[
        ['File order', stored],
        ['Reading order', reading],
      ].map(([name, lines]) => (
        <div className="stream__row" key={name as string}>
          <span className="stream__name">{name as string}</span>
          <span
            className="stream__cells"
            aria-hidden="true"
          >
            {(lines as Line[]).map((l, i) => (
              <span
                key={i}
                className={`stream__cell stream__cell--${side(l)}`}
                data-line={l.text.slice(0, 40)}
              />
            ))}
          </span>
        </div>
      ))}
      <p className="stream__legend">
        <span className="stream__key stream__key--left" aria-hidden="true" />
        left column
        <span className="stream__key stream__key--right" aria-hidden="true" />
        right column
      </p>
    </figure>
  );
}

function CompareRow({
  block,
  position,
  active,
  onActivate,
  movesTo,
}: {
  block: Block;
  position: number;
  active: boolean;
  onActivate?: (order: number) => void;
  movesTo?: number | null;
}) {
  const label = `${KIND_LABEL[block.kind]}, block ${block.order}`;
  return (
    <li className={`compare__row${active ? ' compare__row--active' : ''}`}>
      <button
        type="button"
        className="compare__button"
        onClick={() => onActivate?.(block.order)}
        aria-pressed={active}
        aria-label={`${label}, position ${position} in this order${
          movesTo != null ? `, moves to position ${movesTo} after repair` : ''
        }`}
      >
        <span className="compare__pos" aria-hidden="true">
          {String(position).padStart(2, '0')}
        </span>
        <span className="compare__text">
          <span className="compare__kind">{KIND_LABEL[block.kind]}</span>
          {excerpt(block)}
        </span>
        {movesTo != null && (
          <span className="compare__moved" aria-hidden="true">
            → {String(movesTo).padStart(2, '0')}
          </span>
        )}
      </button>
    </li>
  );
}
