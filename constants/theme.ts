import { StyleSheet } from 'react-native'
import { Colors } from './colors'

// Typography
export const FontSize = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  '2xl': 22,
  '3xl': 28,
  '4xl': 32,
}

export const FontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
}

// Spacing
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
  '5xl': 60,
}

// Border radius
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
}

// Shared component styles used across the entire app
export const GlobalStyles = StyleSheet.create({

  // Screen containers
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screenContent: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing['5xl'],
    maxWidth: 500,
    alignSelf: 'center' as const,
    width: '100%',
    gap: Spacing.md,
  },

  // Floating bottom button (Save, Continue, etc.)
  floatingButtonContainer: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    paddingBottom: Spacing['3xl'],
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center' as const,
  },

  // Primary button
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center' as const,
    width: '100%',
    maxWidth: 500,
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },

  // Skip / secondary link button
  skipButton: {
    paddingVertical: Spacing.sm,
    alignItems: 'center' as const,
  },
  skipButtonText: {
    color: Colors.textSecondary,
    fontSize: FontSize.base,
  },

  // Cards
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },

  // Section headers
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },

  // Page titles
  pageTitle: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },

  // Subtitles
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // Back button
  backButton: {
    marginBottom: Spacing.sm,
  },
  backButtonText: {
    color: Colors.primary,
    fontSize: FontSize.lg,
  },

  // Progress bar (onboarding)
  progressWrap: {
    marginBottom: Spacing.xl,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden' as const,
    marginBottom: 6,
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },

  // Input fields
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.lg,
    color: Colors.text,
  },

  // Error text
  errorText: {
    color: Colors.danger,
    fontSize: FontSize.base,
    textAlign: 'center' as const,
  },

  // Info box
  infoBox: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
  infoBoxText: {
    fontSize: FontSize.base,
    color: Colors.text,
    lineHeight: 22,
  },

  // Navigation bar height reference
  navBarHeight: {
    height: 54,
  },
})