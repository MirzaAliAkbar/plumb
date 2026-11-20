import './ConfidenceBadge.css';

export interface ConfidenceBadgeProps {
  /** 0..1 */
  value: number;
  warning?: string;
  size?: 'sm' | 'md';
}

/**
 * Shows how sure the pipeline is about a block.
 *
 * The important detail is that low confidence is conveyed by a word and an
 * icon, not only by colour — this has to survive colour blindness and forced
 * colours mode.
 */
export function ConfidenceBadge({ value, warning, size = 'md' }: ConfidenceBadgeProps) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const level = pct >= 80 ? 'high' : pct >= 60 ? 'medium' : 'low';
  const label = level === 'high' ? 'Confident' : level === 'medium' ? 'Fairly sure' : 'Unsure';

  return (
    <span className={`confidence confidence--${level} confidence--${size}`}>
      <span className="confidence__dot" aria-hidden="true" />
      <span className="confidence__pct">{pct}%</span>
      <span className="confidence__label">{label}</span>
      {warning && <span className="visually-hidden">. {warning}</span>}
    </span>
  );
}
