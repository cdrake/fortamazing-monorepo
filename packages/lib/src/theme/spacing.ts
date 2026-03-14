/**
 * Shared spacing scale for FortAmazing.
 * Values match the mobile app's theme exactly.
 */

/** Spacing scale in pixels (for React Native / general use) */
export const spacing = {
  xxxs: 2,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const

/** Spacing scale in rem units (for web, base 16px) */
export const remSpacing = {
  xxxs: "0.125rem",
  xxs: "0.25rem",
  xs: "0.5rem",
  sm: "0.75rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  xxl: "3rem",
  xxxl: "4rem",
} as const
