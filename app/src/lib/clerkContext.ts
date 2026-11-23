import { createContext, useContext } from 'react';
import { useUser as useClerkUser } from '@clerk/react';

/**
 * The slice of Clerk's `useUser` the app consumes, plus a context that makes it
 * safe to read in a build that has no Clerk key.
 *
 * Clerk's own hooks throw without a `ClerkProvider` above them. A keyless build
 * is a first-class configuration here, so the provider boundary lives in
 * `clerk.tsx` and the signed-out default is supplied there; this module only
 * defines the shape and the reader so any component can call `useClerk()`
 * unconditionally.
 */
export interface ClerkState {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: NonNullable<ReturnType<typeof useClerkUser>['user']> | null;
}

/** The value used when the build has no Clerk key. */
export const SIGNED_OUT: ClerkState = { isLoaded: true, isSignedIn: false, user: null };

export const ClerkContext = createContext<ClerkState>(SIGNED_OUT);

/** Safe replacement for Clerk's `useUser` / `useAuth`. */
export function useClerk(): ClerkState {
  return useContext(ClerkContext);
}