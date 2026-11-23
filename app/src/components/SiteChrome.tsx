import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import { useClerk } from '../lib/clerkContext';
import { clerkConfigured } from '../lib/authConfig';
import './SiteChrome.css';

/**
 * The Plumb wordmark: a plumb bob, the weight on a string that finds true
 * vertical. Drawn rather than typed so it holds at every size and follows the
 * accent colour into dark mode.
 */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand${compact ? ' brand--compact' : ''}`}>
      <span className="brand__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="2.6" r="1.4" fill="currentColor" />
          <path
            d="M12 4.2v9.1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M12 13.1 16.6 17 12 21.6 7.4 17z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      Plumb
    </span>
  );
}

interface HeaderProps {
  /** Marketing pages show in-page anchors instead of app links. */
  marketing?: boolean;
}

export function SiteHeader({ marketing = false }: HeaderProps) {
  const { isSignedIn } = useClerk();

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="site-header__brand" aria-label="Plumb — home">
          <Brand />
        </Link>

        <nav className="site-header__nav" aria-label="Primary">
          {marketing ? (
            <>
              <a href="#how">How it works</a>
              <a href="#why">Why it matters</a>
              <Link to="/app">Open the tool</Link>
            </>
          ) : (
            <>
              <NavLink to="/app" end>
                Repair a PDF
              </NavLink>
              {isSignedIn && <NavLink to="/library">Library</NavLink>}
            </>
          )}
        </nav>

        <div className="site-header__auth">
          {clerkConfigured && (
            <>
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button type="button" className="btn btn--ghost btn--sm">
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button type="button" className="btn btn--primary btn--sm">
                    Create account
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <UserButton appearance={{ elements: { avatarBox: 'plumb-avatar' } }} />
              </Show>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p className="site-footer__line">
          <Brand compact /> — reading order, repaired on your device.
        </p>
        <nav className="site-footer__nav" aria-label="Footer">
          <Link to="/app">Repair a PDF</Link>
          <a href="https://github.com/MirzaAliAkbar/plumb" rel="noopener noreferrer">
            Source
          </a>
        </nav>
      </div>
    </footer>
  );
}

/** Page frame: skip link, header, main landmark, footer. */
export function Page({
  children,
  marketing = false,
  wide = false,
}: {
  children: ReactNode;
  marketing?: boolean;
  wide?: boolean;
}) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader marketing={marketing} />
      <main id="main" className={wide ? 'main main--wide' : 'main'}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
