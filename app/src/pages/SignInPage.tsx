import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { SignIn } from '@clerk/react';
import { Page } from '../components/SiteChrome';
import { clerkConfigured } from '../lib/authConfig';
import '../styles/auth.css';

/**
 * Sign-in.
 *
 * Reached deliberately from the header, and used as the destination for the
 * protected `/library` route. The marketing page never forces it: the tool works
 * without an account, and a wall in front of that would be a lie.
 */
export function SignInPage() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <Page>
      <div className="auth">
        <div className="auth__panel">
          <h1 className="auth__title">Welcome back</h1>
          <p className="auth__lede">
            Sign in to reach the documents you have already analysed.
          </p>
          {!clerkConfigured ? (
            <div className="auth__unavailable">
              <p>
                Accounts are not configured in this build. The repair tool works without
                one.
              </p>
              <Link className="btn btn--primary" to="/app?sample=1">
                Open the two-column sample
              </Link>
            </div>
          ) : isLoaded && isSignedIn ? (
            <p className="auth__signed-in">
              You are already signed in. <Link to="/app">Open the tool</Link> or{' '}
              <Link to="/library">go to your library</Link>.
            </p>
          ) : (
            <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
          )}
        </div>
      </div>
    </Page>
  );
}
