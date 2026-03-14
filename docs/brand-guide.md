# FortAmazing Brand Guide

## Brand Personality

FortAmazing is an **adventurous, warm, and grounded** outdoor activity platform. The brand voice is:
- **Encouraging** — motivating users to explore and push their limits
- **Authentic** — celebrating real outdoor experiences, not perfection
- **Community-driven** — connecting people through shared adventures
- **Practical** — providing useful tools without unnecessary complexity

## Color Palette

### Primary: Terracotta

The terracotta palette evokes sun-baked earth, canyon walls, and desert trails. It provides warmth and energy without the intensity of pure red.

| Token | Hex | Usage |
|-------|-----|-------|
| primary-100 | `#F4E0D9` | Light backgrounds, hover states |
| primary-200 | `#E8C1B4` | Subtle highlights |
| primary-300 | `#DDA28E` | Secondary accents |
| primary-400 | `#D28468` | Interactive elements (hover) |
| primary-500 | `#C76542` | **Primary brand color** — buttons, links, nav |
| primary-600 | `#A54F31` | Dark variant — pressed states, emphasis |

### Secondary: Slate Blue

Slate blue provides contrast and calm — suggesting mountain twilight and deep water. Used for secondary actions and information hierarchy.

| Token | Hex | Usage |
|-------|-----|-------|
| secondary-100 | `#DCDDE9` | Light backgrounds |
| secondary-200 | `#BCC0D6` | Borders, dividers |
| secondary-300 | `#9196B9` | Muted text |
| secondary-400 | `#626894` | Interactive secondary |
| secondary-500 | `#41476E` | **Secondary brand color** — secondary buttons |

### Accent: Warm Gold

Warm gold suggests sunrise, trail markers, and achievement. Used sparingly for highlights, badges, and calls to attention.

| Token | Hex | Usage |
|-------|-----|-------|
| accent-100 | `#FFEED4` | Light highlight backgrounds |
| accent-200 | `#FFE1B2` | Subtle emphasis |
| accent-300 | `#FDD495` | Progress indicators |
| accent-400 | `#FBC878` | Badges, stars |
| accent-500 | `#FFBB50` | **Accent color** — highlights, achievements |

### Neutrals: Warm Grays

Warm grays (tinted slightly toward the terracotta family) maintain visual cohesion across the UI.

| Token | Hex | Usage |
|-------|-----|-------|
| neutral-100 | `#FFFFFF` | Card backgrounds |
| neutral-200 | `#F4F2F1` | Page backgrounds |
| neutral-300 | `#D7CEC9` | Borders, separators |
| neutral-400 | `#B6ACA6` | Placeholder text |
| neutral-500 | `#978F8A` | Muted icons |
| neutral-600 | `#564E4A` | Secondary text |
| neutral-700 | `#3C3836` | Dark surfaces |
| neutral-800 | `#191015` | Primary text |
| neutral-900 | `#000000` | Maximum contrast |

### Error: Deep Orange-Red

| Token | Hex | Usage |
|-------|-----|-------|
| error-100 | `#F2D6CD` | Error backgrounds |
| error-500 | `#C03403` | Error text, destructive actions |

## Typography

### Primary Font: Space Grotesk

A geometric sans-serif with personality. The angular forms echo mountain peaks and trail markers while maintaining excellent readability.

- **Weights**: Light (300), Regular (400), Medium (500), SemiBold (600), Bold (700)
- **Usage**: Headings, navigation, buttons, body text
- **Loading**: Google Fonts (`next/font/google` on web, `@expo-google-fonts/space-grotesk` on mobile)

### Complementary Body Font

For long-form content where Space Grotesk may feel too geometric:
- **Web**: System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`)
- **iOS**: Helvetica Neue
- **Android**: Roboto (system default)

### Monospace

- **iOS**: Courier
- **Android**: monospace

## Logo Concepts

### Concept 1: Mountain Fort
A stylized mountain peak with crenellations (fort battlements) along the ridgeline. Combines the "Fort" and "Amazing" (outdoor/mountain) meanings. Simple enough to work as an app icon.

### Concept 2: Trail Compass
The letters "FA" integrated into a compass rose, with the "A" forming a mountain/arrow pointing north. Suggests navigation, exploration, and direction.

### Concept 3: Summit Shield
A shield shape (fort/protection) containing a mountain silhouette with a winding trail. The shield suggests strength and community; the trail suggests adventure.

## Accessibility Notes

- Primary (#C76542) on white: **3.6:1 contrast ratio** — passes AA for large text, not for body text
- Primary-600 (#A54F31) on white: **5.2:1** — passes AA for all text
- Secondary (#41476E) on white: **7.2:1** — passes AAA
- Neutral-800 (#191015) on neutral-200 (#F4F2F1): **15.3:1** — passes AAA
- Use primary-600 for text on light backgrounds; primary-500 is fine for buttons with white text

## Voice and Tone

| Context | Tone | Example |
|---------|------|---------|
| Onboarding | Welcoming, simple | "Ready to hit the trail?" |
| Achievements | Celebratory, genuine | "12 miles today. That's a good day." |
| Errors | Calm, helpful | "We lost the signal. Your track is safe." |
| Empty states | Encouraging | "Your first adventure starts here." |
