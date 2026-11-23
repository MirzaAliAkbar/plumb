import type { ReactNode } from 'react';
import { ClerkProvider, useUser as useClerkUser } from '@clerk/react';
import { clerkAppearance } from '../clerkAppearance';
import { clerkConfigured } from './authConfig';
import { ClerkContext, SIGNED_OUT } from './clerkContext';

/**
 * Clerk's provider, mounted only when this build was given a publishable key.
 *
 * When the key is present, `ClerkBridge` reads the real session once and shares
 * it through context; when it is absent, the signed-out context is provided
 * instead and no Clerk hook ever runs. That keeps the rest of the app free of
 * `clerkConfigured` guards around hook calls — one missed guard used to crash
 * the whole live site, which shipped without a key.
 */
export function ClerkScope({ children }: { children: ReactNode }) {
  if (!clerkConfigured) {
    return <ClerkContext.Provider value={SIGNED_OUT}>{children}</ClerkContext.Provider>;
  }

  return (
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      appearance={clerkAppearance}
    >
      <ClerkBridge>{children}</ClerkBridge>
    </ClerkProvider>
  );
}

/** Reads Clerk's real state and republishes it through our context. */
function ClerkBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, user } = useClerkUser();
  return (
    <ClerkContext.Provider
      value={{ isLoaded, isSignedIn: Boolean(isSignedIn), user: user ?? null }}
    >
      {children}
    </ClerkContext.Provider>
  );
}