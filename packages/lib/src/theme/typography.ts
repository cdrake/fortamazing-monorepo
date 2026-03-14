/**
 * Shared typography tokens for FortAmazing.
 * Platform-agnostic values — no react-native or CSS imports.
 */

/** Font family name constants */
export const fontFamilies = {
  /** Primary brand font */
  primary: "Space Grotesk",
  /** Secondary/body font */
  secondary: "Helvetica Neue",
  /** Monospace font for code */
  monospace: "Courier",
} as const

/** Font weight name-to-number mapping */
export const fontWeights = {
  light: 300,
  regular: 400,
  medium: 500,
  semiBold: 600,
  bold: 700,
} as const

/** Font size scale in pixels */
export const fontSizes = {
  xxs: 10,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 40,
} as const

/** Line height ratios (multiply by font size) */
export const lineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const
