import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react';
import './styles/theme.css';
import { App } from './App';
import { clerkAppearance } from './clerkAppearance';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const clerkConfigured = Boolean(PUBLISHABLE_KEY);

if (!clerkConfigured) {
  console.warn(
    '[plumb] VITE_CLERK_PUBLISHABLE_KEY is not set. Sign-in and library sync disabled. ' +
      'The repair tool works without an account.',
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {clerkConfigured ? (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY!} appearance={clerkAppearance}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ClerkProvider>
    ) : (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )}
  </StrictMode>,
);

// Offline support. Registered after paint so it never delays first interaction,
// and only in production builds — a service worker in dev fights HMR.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Offline support is a bonus; never surface a failure to the user.
    });
  });
}
