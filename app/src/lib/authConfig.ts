/**
 * Whether this build was given a Clerk publishable key.
 *
 * The demo does not need an account, so a keyless build is a legitimate
 * configuration: everything except sign-in and the cross-device library works.
 * CI builds without the key, and so does anyone running the repo from scratch.
 * Those builds show an explanation instead of mounting an auth form that cannot
 * load.
 */
export const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
