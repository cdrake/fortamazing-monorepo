/**
 * Shared color palette for FortAmazing.
 * Values match the mobile app's theme exactly.
 */

/** Raw color palette — hex values */
export const palette = {
  neutral100: "#FFFFFF",
  neutral200: "#F4F2F1",
  neutral300: "#D7CEC9",
  neutral400: "#B6ACA6",
  neutral500: "#978F8A",
  neutral600: "#564E4A",
  neutral700: "#3C3836",
  neutral800: "#191015",
  neutral900: "#000000",

  primary100: "#F4E0D9",
  primary200: "#E8C1B4",
  primary300: "#DDA28E",
  primary400: "#D28468",
  primary500: "#C76542",
  primary600: "#A54F31",

  secondary100: "#DCDDE9",
  secondary200: "#BCC0D6",
  secondary300: "#9196B9",
  secondary400: "#626894",
  secondary500: "#41476E",

  accent100: "#FFEED4",
  accent200: "#FFE1B2",
  accent300: "#FDD495",
  accent400: "#FBC878",
  accent500: "#FFBB50",

  angry100: "#F2D6CD",
  angry500: "#C03403",

  overlay20: "rgba(25, 16, 21, 0.2)",
  overlay50: "rgba(25, 16, 21, 0.5)",
} as const

/** Semantic color tokens for light mode */
export const lightColors = {
  /** The default text color */
  text: palette.neutral800,
  /** Secondary/dimmed text */
  textDim: palette.neutral600,
  /** Screen background */
  background: palette.neutral200,
  /** Default border color */
  border: palette.neutral400,
  /** Main tinting/brand color (terracotta) */
  tint: palette.primary500,
  /** Inactive tint */
  tintInactive: palette.neutral300,
  /** Subtle separator lines */
  separator: palette.neutral300,
  /** Error text */
  error: palette.angry500,
  /** Error background */
  errorBackground: palette.angry100,
  /** Transparent helper */
  transparent: "rgba(0, 0, 0, 0)",
} as const

/** Semantic color tokens for dark mode */
export const darkColors = {
  /** The default text color */
  text: palette.neutral200,
  /** Secondary/dimmed text */
  textDim: palette.neutral400,
  /** Screen background */
  background: palette.neutral800,
  /** Default border color */
  border: palette.neutral600,
  /** Main tinting/brand color (terracotta) */
  tint: palette.primary400,
  /** Inactive tint */
  tintInactive: palette.neutral600,
  /** Subtle separator lines */
  separator: palette.neutral700,
  /** Error text */
  error: palette.angry500,
  /** Error background */
  errorBackground: palette.angry100,
  /** Transparent helper */
  transparent: "rgba(0, 0, 0, 0)",
} as const

/**
 * HSL string versions of the palette for web CSS custom properties.
 * Format: "H S% L%" (without the hsl() wrapper, matching shadcn convention).
 */
export const hslColors = {
  primary: "16 52% 52%",
  primaryDark: "16 55% 42%",
  primaryForeground: "0 0% 100%",

  secondary: "233 26% 34%",
  secondaryForeground: "0 0% 100%",

  accent: "39 100% 66%",
  accentForeground: "16 52% 52%",

  background: "30 14% 95%",
  foreground: "330 19% 9%",

  card: "0 0% 100%",
  cardForeground: "330 19% 9%",

  popover: "0 0% 100%",
  popoverForeground: "330 19% 9%",

  muted: "24 11% 83%",
  mutedForeground: "17 7% 44%",

  border: "22 10% 68%",
  input: "22 10% 68%",
  ring: "16 52% 52%",

  destructive: "15 97% 38%",
  destructiveForeground: "0 0% 100%",

  /** Dark mode overrides */
  dark: {
    background: "330 19% 9%",
    foreground: "30 14% 95%",
    card: "0 2% 23%",
    cardForeground: "30 14% 95%",
    popover: "0 2% 23%",
    popoverForeground: "30 14% 95%",
    primary: "16 49% 55%",
    primaryForeground: "0 0% 100%",
    secondary: "233 26% 34%",
    secondaryForeground: "0 0% 100%",
    accent: "39 100% 66%",
    accentForeground: "330 19% 9%",
    muted: "0 2% 23%",
    mutedForeground: "22 10% 68%",
    border: "17 7% 30%",
    input: "17 7% 30%",
    ring: "16 49% 55%",
    destructive: "15 97% 38%",
    destructiveForeground: "0 0% 100%",
  },
} as const
