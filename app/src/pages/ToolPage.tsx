import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useUser } from '@clerk/react';
import { Dropzone } from '../components/Dropzone';
import { PageOverlay } from '../components/PageOverlay';
import { OrderCompare } from '../components/OrderCompare';
import { ReadingView } from '../components/ReadingView';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { Page } from '../components/SiteChrome';
import { extractDocument, PdfOpenError } from '../lib/extract';
import { renderSourcePage } from '../lib/render';
import { analyseDocument } from '../lib/pipeline';
import { toSemanticHtml } from '../lib/export';
import type { DocumentAnalysis } from '../lib/types';
import { loadAnalysis, loadSource, mergeRecord, readIndex, saveDocument } from '../lib/store';
import '../styles/tool.css';

type Phase =
  | { kind: 'idle' }
  | { kind: 'working'; fileName: string; done: number; total: number }
  | { kind: 'password'; fileName: string; wrong: boolean }
  | { kind: 'failed'; title: string; message: string; recoverable: boolean }
  | { kind: 'ready'; doc: DocumentAnalysis; saved: boolean; saving: boolean };

const SAMPLE_PAPER = { name: 'two-column-paper.pdf', url: '/samples/two-column-paper.pdf' };

/** What to tell the user, per failure. Each names the problem *and* the fix. */
function explain(err: unknown, fileName: string): {
  title: string;
  message: string;
  recoverable: boolean;
} {
  if (err instanceof PdfOpenError) {
    switch (err.failure.kind) {
      case 'password':
        return {
          title: 'This PDF is password-protected',
          message: `${fileName} needs a password to open. Plumb will ask for it and never stores it.`,
          recoverable: true,
        };
      case 'invalid':
        return {
          title: 'That file is not a PDF',
          message: `${fileName} does not contain a PDF. If you downloaded it from a website, it may be an HTML error page saved with a .pdf name — open it in a browser to check.`,
          recoverable: true,
        };
      case 'corrupt':
        return {
          title: 'That PDF is damaged',
          message: `${fileName} is incomplete — the end of the file is missing, which usually means the download was interrupted. Try downloading it again.`,
          recoverable: true,
        };
      case 'unsupported':
        return {
          title: 'That PDF uses a feature Plumb cannot read',
          message:
            'The file uses an encryption or encoding scheme this build does not support. If it opens in your PDF viewer, please report it — that is a bug worth fixing.',
          recoverable: true,
        };
      default:
        return {
          title: 'That PDF could not be read',
          message: `Plumb hit an unexpected error: ${err.failure.detail}. The file itself may still be fine.`,
          recoverable: true,
        };
    }
  }
  return {
    title: 'Something went wrong',
    message: err instanceof Error ? err.message : 'An unexpected error occurred.',
    recoverable: true,
  };
}

export function ToolPage() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [pageIndex, setPageIndex] = useState(0);
  const [activeOrder, setActiveOrder] = useState<number | null>(null);
  const [view, setView] = useState<'overlay' | 'compare' | 'reading'>('overlay');
  /** Rendered page previews, keyed by page index. Memory only. */
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [previewFailed, setPreviewFailed] = useState(false);
  /** The file or stored blob the previews are drawn from. */
  const previewSource = useRef<Blob | null>(null);
  const [params, setParams] = useSearchParams();
  const { isSignedIn, user } = useUser();
  const announceRef = useRef<HTMLParagraphElement>(null);
  const pendingFile = useRef<File | null>(null);
  /** Resolver for the in-page password prompt currently on screen. */
  const passwordResolver = useRef<{
    resolve: (pw: string) => void;
    reject: (e: Error) => void;
  } | null>(null);

  const announce = useCallback((msg: string) => {
    if (announceRef.current) announceRef.current.textContent = msg;
  }, []);

  /**
   * Ask for the password in-page rather than with `window.prompt`, so it is
   * announced properly, works with a password manager, and can say when the
   * previous attempt was wrong.
   *
   * pdf.js calls this again with `wrong: true` if the password was rejected, so
   * the same prompt stays up and gains an error message instead of the whole
   * document being re-read.
   */
  const askPassword = useCallback(
    (fileName: string, wrong: boolean) =>
      new Promise<string>((resolve, reject) => {
        passwordResolver.current = { resolve, reject };
        setPhase({ kind: 'password', fileName, wrong });
        announce(
          wrong ? 'That password was wrong. Try again.' : 'This PDF needs a password.',
        );
      }),
    [announce],
  );

  /**
   * Render one page for the overlay.
   *
   * A failed preview must not take the analysis down with it: the outlines and
   * the reading view are still useful, so the overlay falls back to paper.
   */
  const drawPreview = useCallback(async (source: Blob, index: number) => {
    try {
      const rendered = await renderSourcePage(source, index);
      setPreviews((p) => ({ ...p, [index]: rendered.dataUrl }));
    } catch (err) {
      console.warn('[plumb] could not render the page preview:', err);
      setPreviewFailed(true);
    }
  }, []);

  const run = useCallback(
    async (file: File) => {
      setPhase({ kind: 'working', fileName: file.name, done: 0, total: 0 });
      setPageIndex(0);
      setActiveOrder(null);
      setView('overlay');
      setPreviews({});
      setPreviewFailed(false);
      previewSource.current = file;
      announce(`Opening ${file.name}.`);

      try {
        const extracted = await extractDocument(
          file,
          (done, total) => setPhase({ kind: 'working', fileName: file.name, done, total }),
          (wrong) => askPassword(file.name, wrong),
        );

        if (extracted.pages.every((p) => p.runs.length === 0)) {
          setPhase({
            kind: 'failed',
            title: 'That PDF has no text layer',
            message:
              'Every page is an image, which means it is a scan. Reordering a scan needs OCR, and Plumb deliberately does not do OCR — a wrong guess at someone’s words is worse than saying so. Try a text-based PDF, or run OCR on this one first.',
            recoverable: true,
          });
          announce('That PDF appears to be a scan, so there is no text to reorder.');
          return;
        }

        const doc = analyseDocument(extracted);
        setPhase({ kind: 'ready', doc, saved: false, saving: false });
        announce(
          `Done. ${doc.pageCount} pages, overall confidence ${Math.round(doc.confidence * 100)} percent.`,
        );

        // Persist: the analysis locally, the index on the account.
        if (isSignedIn && user) {
          void persist(doc, file);
        }
        // Draw the first page while the result is on screen. This is a second
        // local read of the file; the page itself never leaves the device.
        void drawPreview(file, 0);
      } catch (err) {
        console.error(err);
        const info = explain(err, file.name);
        setPhase({ kind: 'failed', ...info });
        announce(info.title);
      }
    },
    // `persist` is defined below; it closes over the same `user` value, so the
    // dependency list would only force a rebuild on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [announce, askPassword, drawPreview, isSignedIn, user],
  );

  const persist = useCallback(
    async (doc: DocumentAnalysis, file: File) => {
      if (!user) return;
      setPhase((p) => (p.kind === 'ready' ? { ...p, saving: true } : p));
      try {
        const record = await saveDocument(doc, file);
        const index = mergeRecord(readIndex(user.unsafeMetadata), record);
        await user.updateMetadata({ unsafeMetadata: { documents: index } });
        setPhase((p) => (p.kind === 'ready' ? { ...p, saved: true, saving: false } : p));
        announce('Saved to your library.');
      } catch (err) {
        // A failed save must never discard the analysis the user is looking at.
        console.warn('[plumb] could not save to library:', err);
        setPhase((p) => (p.kind === 'ready' ? { ...p, saving: false } : p));
        announce('Analysed, but could not save to your library.');
      }
    },
    [announce, user],
  );

  // Open a saved document from the library (?doc=<id>).
  useEffect(() => {
    const id = params.get('doc');
    if (!id || phase.kind !== 'idle') return;
    let cancelled = false;
    (async () => {
      setPhase({ kind: 'working', fileName: 'Saved document', done: 0, total: 0 });
      try {
        const doc = await loadAnalysis(id);
        if (cancelled) return;
        if (!doc) {
          setPhase({
            kind: 'failed',
            title: 'That document is not on this device',
            message:
              'Your library index is on your account, but the document itself is stored per browser. It was saved on another device or has been cleared.',
            recoverable: true,
          });
          return;
        }
        setPhase({ kind: 'ready', doc, saved: true, saving: false });
        // The preview needs the original bytes, which are stored alongside the
        // analysis. If they are missing the overlay still works on paper.
        const source = await loadSource(id);
        if (source && !cancelled) {
          previewSource.current = source;
          void drawPreview(source, 0);
        }
        announce(`Opened ${doc.fileName} from your library.`);
      } catch {
        if (!cancelled) {
          setPhase({
            kind: 'failed',
            title: 'That document could not be opened',
            message: 'The stored copy is unreadable. Try opening the original file again.',
            recoverable: true,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, phase.kind, announce, drawPreview]);

  // Draw a page the first time it is shown. Previews are kept in state so
  // paging back and forth does not re-read the file.
  useEffect(() => {
    if (phase.kind !== 'ready' || !previewSource.current) return;
    if (previews[pageIndex]) return;
    void drawPreview(previewSource.current, pageIndex);
  }, [phase.kind, pageIndex, previews, drawPreview]);

  const handleFile = useCallback(
    (file: File) => {
      pendingFile.current = file;
      void run(file);
    },
    [run],
  );

  const submitPassword = (pw: string) => {
    const resolver = passwordResolver.current;
    passwordResolver.current = null;
    if (resolver) {
      resolver.resolve(pw);
      // Back to the working state while pdf.js retries with the new password.
      setPhase({ kind: 'working', fileName: pendingFile.current?.name ?? 'document', done: 0, total: 0 });
    }
  };

  const loadSample = useCallback(async () => {
    try {
      const res = await fetch(SAMPLE_PAPER.url);
      if (!res.ok) throw new Error('sample missing');
      const blob = await res.blob();
      await handleFile(new File([blob], SAMPLE_PAPER.name, { type: 'application/pdf' }));
    } catch {
      setPhase({
        kind: 'failed',
        title: 'The sample document could not be loaded',
        message: 'It is served from this site, so a network problem is the likely cause.',
        recoverable: true,
      });
    }
  }, [handleFile]);

  // A direct link from the landing page. The query is removed after it fires so
  // a refresh does not re-run the sample over work the user has started.
  const sampleRequested = useRef(false);
  useEffect(() => {
    if (params.get('sample') !== '1' || sampleRequested.current) return;
    sampleRequested.current = true;
    setParams({}, { replace: true });
    void loadSample();
  }, [params, setParams, loadSample]);

  const currentPage = useMemo(
    () => (phase.kind === 'ready' ? phase.doc.pages[pageIndex] : null),
    [phase, pageIndex],
  );

  const download = () => {
    if (phase.kind !== 'ready') return;
    const base = phase.doc.fileName.replace(/\.pdf$/i, '');
    const html = toSemanticHtml(phase.doc, base);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = base + '-accessible.html';
    a.click();
    URL.revokeObjectURL(url);
    announce('Accessible HTML downloaded.');
  };

  const reset = () => {
    passwordResolver.current?.reject(new Error('cancelled'));
    passwordResolver.current = null;
    pendingFile.current = null;
    setPhase({ kind: 'idle' });
    setParams({}, { replace: true });
  };

  return (
    <Page wide>
      {phase.kind === 'idle' && (
        <section className="tool-intro">
          <h1 className="tool-intro__title">Repair a PDF’s reading order</h1>
          <p className="tool-intro__lede">
            Drop a paper, a report, or a set of exported slides. Plumb rebuilds the order
            a screen reader should follow, shows you every decision it made, and hands
            back an accessible copy you can keep.
          </p>
          <div className="tool-intro__drop">
            <Dropzone onFile={handleFile} />
          </div>
          <p className="tool-intro__sample">
            No PDF to hand?{' '}
            <button type="button" className="linkish" onClick={loadSample}>
              Open the two-column sample
            </button>
          </p>
          <ul className="tool-assurances">
            <li>Files are read on this device and never uploaded.</li>
            <li>Works offline once loaded.</li>
            <li>{isSignedIn ? 'Documents you open are saved to your library.' : 'Sign in to keep a library across devices.'}</li>
          </ul>
          {!isSignedIn && (
            <p className="tool-intro__signin">
              You can use Plumb without an account. <Link to="/sign-up">Create one</Link> to
              keep what you analyse.
            </p>
          )}
        </section>
      )}

      {phase.kind === 'working' && (
        <section className="tool-state" aria-busy="true">
          <h1 className="tool-state__title">Reading {phase.fileName}</h1>
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
              style={{ width: phase.total ? `${(phase.done / phase.total) * 100}%` : '10%' }}
            />
          </div>
          <p className="tool-state__sub">
            {phase.total ? `Page ${phase.done} of ${phase.total}` : 'Opening the document…'}
          </p>
        </section>
      )}

      {phase.kind === 'password' && (
        <PasswordPrompt
          fileName={phase.fileName}
          wrong={phase.wrong}
          onSubmit={submitPassword}
          onCancel={reset}
        />
      )}

      {phase.kind === 'failed' && (
        <section className="tool-state tool-state--failed">
          <h1 className="tool-state__title">{phase.title}</h1>
          <p className="tool-state__sub">{phase.message}</p>
          <div className="tool-state__actions">
            <button type="button" className="btn btn--primary" onClick={reset}>
              Try another file
            </button>
          </div>
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
                {phase.saving && ' · saving…'}
                {phase.saved && ' · saved to your library'}
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
              <button type="button" className="btn btn--primary btn--sm" onClick={download}>
                Download accessible HTML
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>
                New file
              </button>
            </div>
          </div>

          <div className="tabs" role="tablist" aria-label="View">
            <button
              type="button"
              role="tab"
              id="tab-overlay"
              aria-controls="panel-result"
              aria-selected={view === 'overlay'}
              className="tab"
              onClick={() => setView('overlay')}
            >
              Reading order
            </button>
            <button
              type="button"
              role="tab"
              id="tab-compare"
              aria-selected={view === 'compare'}
              aria-controls="panel-result"
              className="tab"
              onClick={() => setView('compare')}
            >
              Before / after
            </button>
            <button
              type="button"
              role="tab"
              id="tab-reading"
              aria-selected={view === 'reading'}
              aria-controls="panel-result"
              className="tab"
              onClick={() => setView('reading')}
            >
              Reading view
            </button>
          </div>

          {view !== 'reading' ? (
            <div
              className="result__panel"
              role="tabpanel"
              id="panel-result"
              aria-labelledby={`tab-${view}`}
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
              {view === 'overlay' ? (
                <>
                  <PageOverlay
                    page={currentPage}
                    activeOrder={activeOrder}
                    onActivate={setActiveOrder}
                    background={previews[pageIndex] ?? null}
                  />
                  {!previews[pageIndex] && !previewFailed && (
                    <p className="overlay-loading" role="status">
                      Drawing the page…
                    </p>
                  )}
                  {previewFailed && (
                    <p className="overlay-loading">
                      The page image could not be drawn. The reading order is still correct;
                      the outlines are shown on plain paper.
                    </p>
                  )}
                </>
              ) : (
                <OrderCompare
                  page={currentPage}
                  activeOrder={activeOrder}
                  onActivate={setActiveOrder}
                />
              )}
            </div>
          ) : (
            <div
              className="result__panel"
              role="tabpanel"
              id="panel-result"
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

          {isSignedIn && (
            <div className="result__library">
              <Link to="/library" className="btn btn--ghost btn--sm">
                View library
              </Link>
            </div>
          )}
        </section>
      )}

      <p className="visually-hidden" role="status" aria-live="polite" ref={announceRef} />
    </Page>
  );
}

function PasswordPrompt({
  fileName,
  wrong,
  onSubmit,
  onCancel,
}: {
  fileName: string;
  wrong: boolean;
  onSubmit: (pw: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <section className="tool-state">
      <h1 className="tool-state__title">This PDF is password-protected</h1>
      <p className="tool-state__sub">
        {fileName} needs a password to open. It is used in this tab only and is never sent
        anywhere.
      </p>
      <form
        className="password-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (value) onSubmit(value);
        }}
      >
        <label className="password-form__label" htmlFor="pdf-password">
          Password
        </label>
        <input
          ref={inputRef}
          id="pdf-password"
          className="password-form__input"
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={wrong}
          aria-describedby={wrong ? 'pdf-password-error' : undefined}
        />
        {wrong && (
          <p className="password-form__error" id="pdf-password-error" role="alert">
            That password did not work. Check it and try again.
          </p>
        )}
        <div className="password-form__actions">
          <button type="submit" className="btn btn--primary" disabled={!value}>
            Open document
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
