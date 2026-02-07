# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FortAmazing is a hiking/outdoor activity platform with social features, GPS track management, and photo sharing. The app uses Firebase as its backend (Auth, Firestore, Storage, Cloud Functions).

## Monorepo Structure

This is a pnpm workspace monorepo orchestrated by Turborepo:

- **apps/web** — Next.js 16 web app (React 19, Tailwind CSS, Radix UI, Leaflet maps)
- **apps/mobile** — Expo 54 / React Native 0.81 mobile app (Ignite v11 boilerplate, React Navigation)
- **packages/lib** — Shared TypeScript types and Firebase initialization utilities

**Important**: The root uses pnpm, but each app under `apps/` uses npm with its own `package-lock.json`. Install dependencies within each app directory using `npm install`, not pnpm.

## Common Commands

### Root (monorepo)
```bash
pnpm dev              # Run web + mobile concurrently
pnpm dev:web          # Web only (Next.js dev with turbopack)
pnpm dev:mobile       # Mobile only (Expo dev client)
pnpm lint             # Lint all packages via Turborepo
pnpm build:web        # Build the web app
```

### Web (`apps/web`)
```bash
npm run dev           # Next.js dev server with turbopack
npm run build         # Production build
npm run lint          # ESLint
npm run lint:fix      # ESLint with auto-fix
```

### Mobile (`apps/mobile`)
```bash
npm start             # Expo dev client
npx expo run:ios      # Run on iOS simulator
npm run android       # Run on Android emulator
npm run compile       # TypeScript type-check (tsc --noEmit)
npm run lint          # ESLint with auto-fix
npm run lint:check    # ESLint without auto-fix
npm test              # Jest tests
npm run test:watch    # Jest in watch mode
npm run test:maestro  # Maestro E2E tests
```

### Mobile builds (EAS)
```bash
eas build --profile development --platform ios
eas build --profile preview --platform ios
eas build --profile production --platform ios
# Same patterns for android
```

## Architecture

### Shared Types (`packages/lib`)
All domain types (Hike, Track, ImageMeta, geo types, etc.) live in `packages/lib/src/types/`. Both apps should import shared types from this package. Firebase client initialization helpers are in `packages/lib/src/firebase/` with separate `web.ts` and `mobile.ts` entry points.

Path alias: `@fortamazing/*` maps to `packages/*/src` (configured in root `tsconfig.base.json`).

### Web App (`apps/web`)
- **Routing**: Next.js App Router (`src/app/` directory)
- **Key routes**: `/hikes`, `/dashboard`, `/diet`, `/u/[username]`, `/admin`, `/login`, `/signup`
- **Firebase client**: `src/lib/firebase.ts` — comprehensive client with Firestore, Auth, Storage helpers
- **Styling**: Tailwind CSS with HSL custom properties, tailwindcss-animate
- **Maps**: Leaflet + react-leaflet + Turf.js for geospatial operations
- **Path alias**: `@/*` maps to `src/*`

### Mobile App (`apps/mobile`)
- **Architecture**: Ignite v11 patterns (screens, components, services, navigators, theme)
- **Navigation**: React Navigation with native-stack and bottom-tabs
- **Auth**: `app/context/AuthContext.tsx` — Firebase Auth + Google Sign-In
- **Firebase**: `app/config/firebase.ts`
- **i18n**: i18next with translations in `app/i18n/`
- **Local storage**: MMKV for fast key-value, AsyncStorage for preferences
- **Path aliases**: `@/*` → `app/*`, `@assets/*` → `assets/*`
- **Testing**: Jest + @testing-library/react-native; Maestro flows in `.maestro/`

### Firebase
- **Firestore rules**: `apps/web/firestore.rules`
- **Storage rules**: `apps/web/storage.rules`
- **Firestore indexes**: `apps/web/firestore.indexes.json`
- **Cloud Functions runtime**: Node.js 18

## TypeScript
Both apps use strict mode. The web ESLint config is relaxed on `no-explicit-any` and `no-unused-vars`. The mobile ESLint config is stricter and includes Prettier integration, import ordering, and reactotron production guards.

## Key Domain Concepts
- **Hike**: Core entity with GPS track, photos, elevation data, encoded polyline, geohash for spatial queries
- **Track**: GPS track data with distance, elevation, duration summaries
- **Posts**: Social content tied to users
- **Diet**: Nutrition tracking with USDA/UPC food database integration (web only)
