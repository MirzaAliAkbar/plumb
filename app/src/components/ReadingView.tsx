import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Block, DocumentAnalysis } from '../lib/types';
import { joinLines } from '../lib/lines';
import { createSpeaker } from '../lib/speak';
import { ConfidenceBadge } from './ConfidenceBadge';
import './ReadingView.css';

export interface ReadingViewProps {
  doc: DocumentAnalysis;
  activeOrder: number | null;
  onBlockFocus: (order: number) => void;
}

interface RenderBlock {
  block: Block;
  /** list-items are grouped so we emit one real <ul> */
  listGroup?: Block[];
}

export function ReadingView({ doc, activeOrder, onBlockFocus }: ReadingViewProps) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState('');
  // Created once, in state, so it is stable across renders and never read off a
  // ref during render.
  const [speaker] = useState(createSpeaker);
  const supported = speaker.isSupported();
  const containerRef = useRef<HTMLDivElement>(null);

  // Flatten to a flat, ordered list of blocks across pages.
  const flat = useMemo(() => doc.pages.flatMap((p) => p.blocks), [doc]);

  useEffect(() => () => speaker.stop(), [speaker]);

  useEffect(() => {
    if (activeOrder == null || !containerRef.current) return;
    const el = containerRef.current.querySelector<HTMLElement>(
      `[data-order="${activeOrder}"]`,
    );
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  }, [activeOrder]);

  const read = useCallback(() => {
    if (!supported) return;
    const text = flat.map((b) => joinLines(b.lines)).join('\n\n');
    setSpeaking(true);
    setPaused(false);
    setStatus('Reading the document aloud.');
    speaker.speak(text, (charIndex) => {
      let running = 0;
      for (const b of flat) {
        const len = joinLines(b.lines).length;
        if (charIndex < running + len) {
          onBlockFocus(b.order);
          break;
        }
        running += len + 2;
      }
    });
  }, [flat, onBlockFocus, supported, speaker]);

  const toggle = () => {
    if (!supported) return;
    if (!speaking) {
      read();
      return;
    }
    if (speaker.isPaused()) {
      speaker.resume();
      setPaused(false);
      setStatus('Resumed.');
    } else {
      speaker.pause();
      setPaused(true);
      setStatus('Paused.');
    }
  };

  const stop = () => {
    speaker.stop();
    setSpeaking(false);
    setPaused(false);
    setStatus('Stopped.');
  };

  // Build render groups: consecutive list items share one <ul>.
  const groups = useMemo(() => {
    const out: RenderBlock[] = [];
    for (const block of flat) {
      const last = out[out.length - 1];
      if (block.kind === 'list-item' && last?.block.kind === 'list-item') {
        last.listGroup = [...(last.listGroup ?? [last.block]), block];
        continue;
      }
      out.push({ block, listGroup: block.kind === 'list-item' ? [block] : undefined });
    }
    return out;
  }, [flat]);

  const renderInner = (block: Block) => joinLines(block.lines);

  const BlockInner = ({ block }: { block: Block }) => {
    const text = renderInner(block);
    switch (block.kind) {
      case 'heading':
        return block.lines[0].size > 16 ? <h2>{text}</h2> : <h3>{text}</h3>;
      case 'caption':
        return <figcaption>{text}</figcaption>;
      case 'code':
        return (
          <pre>
            <code>{text}</code>
          </pre>
        );
      case 'table-text':
        return <pre className="reading__table">{text}</pre>;
      case 'paragraph':
        return <p>{text}</p>;
      default:
        return <span>{text}</span>;
    }
  };

  return (
    <div className="reading">
      <div className="reading__toolbar" role="toolbar" aria-label="Read aloud controls">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={toggle}
          disabled={!supported}
          aria-pressed={speaking}
        >
          {!speaking ? 'Read aloud' : paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          className="btn btn--sm"
          onClick={stop}
          disabled={!speaking}
        >
          Stop
        </button>
        {!supported && (
          <span className="reading__unsupported">
            Your browser has no speech voice — the text is still fully readable.
          </span>
        )}
        <p className="reading__status" role="status" aria-live="polite">
          {status}
        </p>
      </div>

      <article
        className="reading__page"
        ref={containerRef}
        aria-label={`Accessible reading copy of ${doc.fileName}`}
      >
        {groups.map((group) => {
          const { block } = group;
          const isActive = activeOrder === block.order;
          const cls = `reading__block reading__block--${block.kind}${
            isActive ? ' reading__block--active' : ''
          }`;

          if (block.kind === 'list-item' && group.listGroup) {
            return (
              <ul className={cls} key={block.order} data-order={block.order}>
                {group.listGroup.map((item) => (
                  <li key={item.order} data-order={item.order}>
                    {renderInner(item)}
                    {item.confidence < 0.6 && (
                      <span className="reading__flag">
                        <ConfidenceBadge value={item.confidence} size="sm" />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            );
          }

          if (block.kind === 'caption') {
            return (
              <figure className={cls} key={block.order} data-order={block.order}>
                <BlockInner block={block} />
              </figure>
            );
          }

          return (
            <div className={cls} key={block.order} data-order={block.order}>
              <BlockInner block={block} />
              {block.confidence < 0.6 && (
                <span className="reading__flag">
                  <ConfidenceBadge value={block.confidence} warning={block.warning} size="sm" />
                </span>
              )}
            </div>
          );
        })}
      </article>
    </div>
  );
}
