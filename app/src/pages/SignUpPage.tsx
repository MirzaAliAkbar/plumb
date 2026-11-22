import { Link } from 'react-router-dom';
import { useAuth, SignUp } from '@clerk/react';
import { Page } from '../components/SiteChrome';
import '../styles/auth.css';

export function SignUpPage() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <Page>
      <div className="auth">
        <div className="auth__panel">
          <h1 className="auth__title">Create an account</h1>
          <p className="auth__lede">
            An account keeps a library of what you have analysed, across your devices. The
            documents themselves still never leave the device they were opened on.
          </p>
          {isLoaded && isSignedIn ? (
            <p className="auth__signed-in">
              You already have an account and are signed in.{' '}
              <Link to="/app">Open the tool</Link>.
            </p>
          ) : (
            <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
          )}
        </div>
      </div>
    </Page>
  );
}
