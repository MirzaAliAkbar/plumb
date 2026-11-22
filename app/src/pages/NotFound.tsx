import { Link } from 'react-router-dom';
import { Page } from '../components/SiteChrome';
import '../styles/auth.css';

export function NotFound() {
  return (
    <Page>
      <div className="auth">
        <div className="auth__panel auth__panel--narrow">
          <h1 className="auth__title">That page does not exist</h1>
          <p className="auth__lede">
            The link may be out of date, or the address may have a typo in it.
          </p>
          <div className="auth__actions">
            <Link to="/" className="btn btn--primary">
              Go to the start page
            </Link>
            <Link to="/app" className="btn btn--ghost">
              Repair a PDF
            </Link>
          </div>
        </div>
      </div>
    </Page>
  );
}
