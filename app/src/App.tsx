import { useCallback, useMemo, useRef, useState } from 'react';
import { Dropzone } from './components/Dropzone';
import { PageOverlay } from './components/PageOverlay';
import { ReadingView } from './components/ReadingView';
import { ConfidenceBadge } from './components/ConfidenceBadge';
import { extractDocument, type ExtractedDocument } from './lib/extract';
import { analyseDocument } from './lib/pipeline';
import { toSemanticHtml } from './lib/export';
import type { DocumentAnalysis } from './lib/types';
import './App.css';

type Phase =
  | { kind: 'idle' }
  | { kind: 'working'; fileName: string; done: number; total: number }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; doc: DocumentAnalysis; extracted: ExtractedDocument };

const SAMPLE_PAPER = { name: 'two-column-paper.pdf', url: './samples/two-column-paper.pdf' };

export default function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [pageIndex, setPageIndex] = useState(0);
  const [activeOrder, setActiveOrder] = useState<number | null>(null);
  const [view, setView] = useState<'overlay' | 'reading'>('overlay');
  const announceRef = useRef<HTMLParagraphElement>(null);

  const announce = (msg: string) => {
    if (announceRef.current) announceRef.current.textContent = msg;
  };

  const handleFile = useCallback(async (file: File) => {
    setPhase({ kind: 'working', fileName: file.name, done: 0, total: 0 });
    setPageIndex(0);
    setActiveOrder(null);
    setView('overlay');
    announce(`Opening ${file.name}.`);

    try {
      const extracted = await extractDocument(file, (done, total) => {
        setPhase({ kind: 'working', fileName: file.name, done, total });
      });

      if (extracted.pages.every((p) => p.runs.length === 0)) {
        setPhase({
          kind: 'failed',
          message:
            'No text found in that PDF. It looks like a scan — those need OCR, which Plumb does not do.',
        });
        announce('That PDF appears to be a scan, so there is no text to reorder.');
        return;
      }

      const doc = analyseDocument(extracted);
      setPhase({ kind: 'ready', doc, extracted });
      announce(
        `Done. ${doc.pageCount} pages, overall confidence ${Math.round(
          doc.confidence * 100,
        )} percent.`,
      );
    } catch (err) {
      console.error(err);
      setPhase({
        kind: 'failed',
        message:
          'That file could not be read. It may be password-protected or damaged.',
      });
      announce('That file could not be read.');
    }
  }, []);

  const loadSample = useCallback(async () => {
    try {
      const res = await fetch(SAMPLE_PAPER.url);
      if (!res.ok) throw new Error('sample missing');
      const blob = await res.blob();
      await handleFile(new File([blob], SAMPLE_PAPER.name, { type: 'application/pdf' }));
    } catch {
      setPhase({
        kind: 'failed',
        message: 'The sample document could not be loaded.',
      });
    }
  }, [handleFile]);

  const currentPage = useMemo(
    () => (phase.kind === 'ready' ? phase.doc.pages[pageIndex] : null),
    [phase, pageIndex],
  );

  const download = () => {
    if (phase.kind !== 'ready') return;
    const html = toSemanticHtml(phase.doc, phase.doc.fileName.replace(/\.pdf$/i, ''));
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = phase.doc.fileName.replace(/\.pdf$/i, '') + '-accessible.html';
    a.click();
    URL.revokeObjectURL(url);
    announce('Accessible HTML downloaded.');
  };

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="site-header">
        <div className="site-header__inner">
          <span className="brand">
            <span className="brand__mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="M5 4v16M5 12h6a6 6 0 0 0 0-12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            Plumb
          </span>
          <nav aria-label="Primary">
            <a href="#how">How it works</a>
            <a href="#about">Why it matters</a>
          </nav>
        </div>
      </header>

      <main id="main">
        {phase.kind === 'idle' && (
          <section className="hero">
            <p className="eyebrow">For screen-reader users</p>
            <h1 className="hero__title">
              Screen readers read PDFs in the wrong order. Plumb fixes it — in your browser.
            </h1>
            <p className="hero__lede">
              Drop a paper or a set of lecture slides. Plumb reconstructs the reading
              order from the page geometry, shows you exactly what it did, and hands back
              a clean accessible copy you can keep.
            </p>
            <div className="hero__drop">
              <Dropzone onFile={handleFile} />
            </div>
            <p className="hero__sample">
              No PDF handy?{" "}
              <button type="button" className="linkish" onClick={loadSample}>
                Open a sample two-column paper
              </button>
            </p>
            <p className="hero__privacy">
              Nothing is uploaded. No account, no key, no network. Everything runs on this
              device.
            </p>
            <p className="hero__note">
              Works on born-digital PDFs — papers, reports, exported slides. Scanned
              documents need OCR, which Plumb deliberately does not do.
            </p>
          </section>
        )}

        {phase.kind === 'working' && (
          <section className="state" aria-busy="true">
            <h1 className="state__title">Reading {phase.fileName}</h1>
            <div
              className="progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={phase.total || 1}
              aria-valuenow={phase.done}
              aria-label="Extracting text"
            >
              <div
                className="progress__bar"
                style={{
                  width: phase.total ? `${(phase.done / phase.total) * 100}%` : '10%',
                }}
              />
            </div>
            <p className="state__sub">
              {phase.total
                ? `Page ${phase.done} of ${phase.total}`
                : 'Opening the document…'}
            </p>
          </section>
        )}

        {phase.kind === 'failed' && (
          <section className="state state--failed">
            <h1 className="state__title">That file did not open</h1>
            <p className="state__sub">{phase.message}</p>
            <button type="button" className="btn btn--primary" onClick={() => setPhase({ kind: 'idle' })}>
              Try another file
            </button>
          </section>
        )}

        {phase.kind === 'ready' && currentPage && (
          <section className="result">
            <div className="result__bar">
              <div className="result__meta">
                <span className="result__name">{phase.doc.fileName}</span>
                <span className="result__stats">
                  {phase.doc.pageCount} page{phase.doc.pageCount === 1 ? '' : 's'} ·{' '}
                  {currentPage.columns === 2 ? 'two columns' : 'one column'}
                </span>
              </div>
              <ConfidenceBadge
                value={phase.doc.confidence}
                warning={
                  phase.doc.confidence < 0.6
                    ? 'Some blocks were uncertain — check the numbered overlay.'
                    : undefined
                }
              />
              <div className="result__actions">
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={download}
                >
                  Download accessible HTML
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setPhase({ kind: 'idle' })}
                >
                  New file
                </button>
              </div>
            </div>

            <div className="tabs" role="tablist" aria-label="View">
              <button
                type="button"
                role="tab"
                id="tab-overlay"
                aria-selected={view === 'overlay'}
                aria-controls="panel-overlay"
                className="tab"
                onClick={() => setView('overlay')}
              >
                Reading order
              </button>
              <button
                type="button"
                role="tab"
                id="tab-reading"
                aria-selected={view === 'reading'}
                aria-controls="panel-reading"
                className="tab"
                onClick={() => setView('reading')}
              >
                Reading view
              </button>
            </div>

            {view === 'overlay' ? (
              <div
                className="result__panel"
                role="tabpanel"
                id="panel-overlay"
                aria-labelledby="tab-overlay"
                tabIndex={0}
              >
                <nav className="pager" aria-label="Page navigation">
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => {
                      setPageIndex((i) => Math.max(0, i - 1));
                      setActiveOrder(null);
                    }}
                    disabled={pageIndex === 0}
                  >
                    Previous
                  </button>
                  <span className="pager__label">
                    Page {pageIndex + 1} of {phase.doc.pageCount}
                  </span>
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => {
                      setPageIndex((i) => Math.min(phase.doc.pageCount - 1, i + 1));
                      setActiveOrder(null);
                    }}
                    disabled={pageIndex === phase.doc.pageCount - 1}
                  >
                    Next
                  </button>
                </nav>
                <PageOverlay
                  page={currentPage}
                  activeOrder={activeOrder}
                  onActivate={setActiveOrder}
                />
              </div>
            ) : (
              <div
                className="result__panel"
                role="tabpanel"
                id="panel-reading"
                aria-labelledby="tab-reading"
                tabIndex={0}
              >
                <ReadingView
                  doc={phase.doc}
                  activeOrder={activeOrder}
                  onBlockFocus={setActiveOrder}
                />
              </div>
            )}
          </section>
        )}

        <section className="explain" id="how">
          <h2>How it works</h2>
          <ol className="explain__steps">
            <li>
              <h3>Extract</h3>
              <p>
                Every text run is pulled out with its exact position on the page, locally,
                using the PDF engine in your browser.
              </p>
            </li>
            <li>
              <h3>Reconstruct</h3>
              <p>
                Lines are grouped by baseline, columns are found from a character-density
                profile across the page, and repeated headers and footers are removed.
              </p>
            </li>
            <li>
              <h3>Hand back</h3>
              <p>
                You get a numbered overlay you can audit and a clean semantic HTML file
                that any screen reader can read properly.
              </p>
            </li>
          </ol>
        </section>

        <section className="explain explain--quiet" id="about">
          <h2>Why it matters</h2>
          <p>
            Most PDFs carry no structure — no headings, no paragraphs, no reading order.
            A screen reader can only follow the order the file happens to store, which for
            a two-column paper means reading across the gutter and interleaving the
            columns. The free tools that exist either tell you the file is broken or
            require a licence and a sighted expert. Plumb does the repair itself, and tells
            you where it is unsure.
          </p>
        </section>
      </main>

      <footer className="site-footer">
        <p>
          Plumb · built for LaunchPad Hacks 2026 · runs entirely on your device ·{' '}
          <a href="https://github.com/MirzaAliAkbar/plumb" rel="noopener">
            source
          </a>
        </p>
      </footer>

      <p className="visually-hidden" role="status" aria-live="polite" ref={announceRef} />
    </>
  );
}
