import type { ClerkProviderProps } from '@clerk/react';

/**
 * Clerk's prebuilt components, dressed in Plumb's own design system.
 *
 * The point is that signing in should not feel like leaving the product for a
 * third-party page. Everything here reads from the same CSS custom properties
 * as the rest of the app (see styles/theme.css), so the auth screens follow the
 * palette into dark mode automatically instead of needing a second set of
 * colours that drifts.
 *
 * The type is taken from the provider's own prop rather than a named export,
 * because `Appearance` is not re-exported from the package root.
 */
export const clerkAppearance: NonNullable<ClerkProviderProps['appearance']> = {
  variables: {
    colorPrimary: 'var(--accent-600)',
    colorPrimaryForeground: 'var(--paper-000)',
    colorForeground: 'var(--ink-900)',
    colorMutedForeground: 'var(--ink-500)',
    colorMuted: 'var(--paper-100)',
    colorBackground: 'var(--paper-000)',
    colorInput: 'var(--paper-000)',
    colorInputForeground: 'var(--ink-900)',
    colorDanger: 'var(--danger-700)',
    colorSuccess: 'var(--accent-600)',
    colorNeutral: 'var(--ink-900)',
    colorBorder: 'var(--paper-300)',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-ui)',
    fontFamilyButtons: 'var(--font-ui)',
    fontSize: '0.95rem',
  },
  elements: {
    rootBox: 'plumb-clerk',
    card: 'plumb-clerk__card',
    headerTitle: 'plumb-clerk__title',
    headerSubtitle: 'plumb-clerk__subtitle',
    socialButtonsBlockButton: 'plumb-clerk__social',
    formButtonPrimary: 'plumb-clerk__submit',
    footerActionLink: 'plumb-clerk__link',
    dividerLine: 'plumb-clerk__divider',
    dividerText: 'plumb-clerk__divider-text',
    formFieldInput: 'plumb-clerk__input',
    formFieldLabel: 'plumb-clerk__label',
    identityPreviewEditButton: 'plumb-clerk__link',
    userButtonPopoverCard: 'plumb-clerk__popover',
  },
};
