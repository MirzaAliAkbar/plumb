import { useCallback, useId, useRef, useState, type DragEvent, type ClipboardEvent } from 'react';
import './Dropzone.css';

export interface DropzoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

const MAX_BYTES = 40 * 1024 * 1024;

function validate(file: File): string | null {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) return `“${file.name}” is not a PDF. Plumb only reads PDF files.`;
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_BYTES) return 'That file is over 40 MB. Try a smaller document.';
  return null;
}

/**
 * File intake.
 *
 * Structure note: the drop area is a plain region, and the only focusable thing
 * inside it is a real <button>. Wrapping a file input inside a role="button"
 * container creates a nested interactive control, which screen readers handle
 * badly — so we do not do that.
 */
export function Dropzone({ onFile, disabled = false }: DropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const hintId = useId();
  const errorId = useId();

  const accept = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const problem = validate(file);
      if (problem) {
        setError(problem);
        return;
      }
      setError(null);
      onFile(file);
    },
    [onFile],
  );

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    depth.current = 0;
    setDragging(false);
    if (disabled) return;
    accept(event.dataTransfer.files?.[0]);
  };

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled) return;
    depth.current += 1;
    setDragging(true);
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    depth.current -= 1;
    if (depth.current <= 0) {
      depth.current = 0;
      setDragging(false);
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const file = Array.from(event.clipboardData.files)[0];
    if (file) {
      event.preventDefault();
      accept(file);
    }
  };

  return (
    <div className="dropzone-wrap">
      <div
        className={`dropzone${dragging ? ' dropzone--active' : ''}${disabled ? ' dropzone--disabled' : ''}`}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onPaste={onPaste}
      >
        <svg className="dropzone__icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <path
            d="M14 34a8 8 0 0 1-.6-16A11 11 0 0 1 34 20a7 7 0 0 1 0 14H28"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M24 24v14M19 31l5-5 5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <p className="dropzone__title">{dragging ? 'Drop to open' : 'Drop a PDF here'}</p>
        <p className="dropzone__hint" id={hintId}>
          or choose a file — it never leaves your device
        </p>

        {/* The only interactive element in the zone: no nested-interactive
            conflict, and its accessible name is its visible text. */}
        <button
          type="button"
          className="btn btn--primary dropzone__button"
          disabled={disabled}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          onClick={() => inputRef.current?.click()}
        >
          Choose a PDF file
        </button>

        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="application/pdf,.pdf"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      <p className="dropzone__error" id={errorId} role="alert">
        {error}
      </p>
    </div>
  );
}
