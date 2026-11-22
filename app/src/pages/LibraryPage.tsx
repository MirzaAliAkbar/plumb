import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/react';
import { Page } from '../components/SiteChrome';
import { deleteDocument, formatSavedAt, readIndex, type DocumentRecord } from '../lib/store';
import '../styles/library.css';

/**
 * The signed-in document library.
 *
 * The index lives on the Clerk user (`unsafeMetadata.documents`), so it follows
 * the account; the documents themselves live in this browser's IndexedDB, so the
 * library can list a document that is not on this device. That is a real state
 * and it is shown honestly rather than hidden.
 */
export function LibraryPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const navigate = useNavigate();
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate('/sign-in', { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate]);

  // Derived during render, not copied into state by an effect: the account's
  // metadata is the source of truth, and `useUser` already re-renders when it
  // changes. A mirrored state copy would only be able to drift from it.
  const records = readIndex(user?.unsafeMetadata);

  const remove = useCallback(
    async (record: DocumentRecord) => {
      if (!user) return;
      setRemoving(record.id);
      setError(null);
      try {
        // Remove locally first: if the metadata write fails, the document is
        // still gone from this device, which is what the user asked for.
        await deleteDocument(record.id);
        const next = readIndex(user.unsafeMetadata).filter((r) => r.id !== record.id);
        // `useUser` re-renders on the new metadata, so the list updates itself.
        await user.updateMetadata({ unsafeMetadata: { documents: next } });
      } catch {
        setError('That document could not be removed from your account. Try again.');
      } finally {
        setRemoving(null);
      }
    },
    [user],
  );

  if (!isLoaded || !isSignedIn) {
    return (
      <Page>
        <div className="library">
          <p className="library__loading">Checking your session…</p>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className="library">
        <header className="library__head">
          <h1 className="library__title">Your library</h1>
          <p className="library__lede">
            {records.length === 0
              ? 'Nothing here yet.'
              : `${records.length} document${records.length === 1 ? '' : 's'} you have analysed.`}
          </p>
        </header>

        {error && (
          <p className="library__error" role="alert">
            {error}
          </p>
        )}

        {records.length === 0 ? (
          <div className="library__empty">
            <p>
              Open a PDF and Plumb will keep the analysis here, so you can come back to it
              without processing the file again.
            </p>
            <Link to="/app" className="btn btn--primary">
              Repair a PDF
            </Link>
          </div>
        ) : (
          <ul className="library__list">
            {records.map((record) => (
              <li className="library__item" key={record.id}>
                <div className="library__item-main">
                  <Link className="library__item-name" to={`/app?doc=${record.id}`}>
                    {record.fileName}
                  </Link>
                  <p className="library__item-meta">
                    {record.pageCount} page{record.pageCount === 1 ? '' : 's'} ·{' '}
                    {Math.round(record.confidence * 100)}% confidence ·{' '}
                    {formatSavedAt(record.savedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => void remove(record)}
                  disabled={removing === record.id}
                  aria-label={`Remove ${record.fileName} from your library`}
                >
                  {removing === record.id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="library__note">
          Documents are stored in this browser only. Your account stores the list, never the
          contents.
        </p>
      </div>
    </Page>
  );
}
