# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and
automated agents when working with code in this repository.

> Goal: Let agents accelerate development while keeping humans in the
> loop for risky or production-impacting actions.

------------------------------------------------------------------------

## Project Overview

FortAmazing is a hiking/outdoor activity platform with social features,
GPS track management, and photo sharing. The app uses Firebase as its
backend (Auth, Firestore, Storage, Cloud Functions).

------------------------------------------------------------------------

## Monorepo Structure

This is a pnpm workspace orchestrated by Turborepo:

-   **apps/web** --- Next.js 16 web app (React 19, Tailwind CSS, Radix
    UI, Leaflet maps)
-   **apps/mobile** --- Expo 54 / React Native 0.81 mobile app (Ignite
    v11 boilerplate, React Navigation)
-   **packages/lib** --- Shared TypeScript types and Firebase
    initialization utilities

Important: The root uses pnpm, but each app under `apps/` uses npm with
its own `package-lock.json`. Install dependencies inside each app
directory using `npm install`, not pnpm.

------------------------------------------------------------------------

## Common Commands

### Root

``` bash
pnpm dev
pnpm dev:web
pnpm dev:mobile
pnpm lint
pnpm build:web
```

### Web (`apps/web`)

``` bash
npm run dev
npm run build
npm run lint
npm run lint:fix
```

### Mobile (`apps/mobile`)

``` bash
npm start
npx expo run:ios
npm run android
npm run compile
npm run lint
npm run lint:check
npm test
npm run test:watch
npm run test:maestro
```

------------------------------------------------------------------------

## Architecture

-   Shared types live in `packages/lib/src/types/`
-   Firebase helpers in `packages/lib/src/firebase/` (web.ts /
    mobile.ts)
-   Web uses App Router (`src/app`)
-   Mobile uses Ignite v11 structure
-   Firestore rules: `apps/web/firestore.rules`
-   Storage rules: `apps/web/storage.rules`
-   Cloud Functions runtime: Node 18

------------------------------------------------------------------------

# AGENT EXECUTION POLICY

These rules apply to any automated agent operating in this repository.

------------------------------------------------------------------------

## Branching Rules

Agents must:

-   Use branch prefix: `agent/<agent-name>/<ticket>-<short-desc>`

Example:

    agent/implement/jira-123-add-login

Agents may:

-   Push automatically only to `agent/*` branches
-   Open PRs from `agent/*` to `main` or `staging`

Agents must NOT:

-   Push directly to `main`
-   Merge into protected branches
-   Bypass CI

------------------------------------------------------------------------

## Command Execution Tiers

### Tier 0 --- Auto-run Allowed

Agents may execute without approval:

-   npm install
-   npm ci
-   npm run build
-   npm test
-   pnpm dev
-   git status
-   git diff
-   git add
-   git commit
-   docker build

### Tier 1 --- Allowed with PR

Agents may:

-   Push to `agent/*` branches
-   Open PRs
-   Trigger CI

Merge requires:

-   At least 1 human reviewer
-   Passing CI

### Tier 2 --- Explicit Human Approval Required

Agents must request approval before:

-   git push origin main
-   git merge main
-   rm -rf
-   sudo
-   terraform apply
-   kubectl apply
-   Production EAS builds
-   Firestore or storage production writes
-   Infrastructure changes

If unsure, agents must ask.

------------------------------------------------------------------------

## Commit Format (Required for Agents)

    agent(<agent-name>): <type>(<scope>): <description> [agent-run-id:<uuid>]

Example:

    agent(implement): feat(hikes): add track polyline parser [agent-run-id: abc123]

------------------------------------------------------------------------

## PR Requirements

Each PR created by an agent must include:

-   Summary
-   List of changed files
-   Test results
-   Confirmation lint passed
-   Agent run ID

Agents must not merge their own PRs.

------------------------------------------------------------------------

## Safety & Secrets

-   Never commit secrets
-   Never store `.env` values in repo
-   Use environment variables only
-   Assume production credentials are restricted

------------------------------------------------------------------------

## Optional: Shell Allowlist Wrapper

Recommended: agents should execute commands through a wrapper at:

`scripts/agent-allowed.sh`

Example:

``` bash
#!/usr/bin/env bash

ALLOWED_PREFIXES=(
  "npm install"
  "npm ci"
  "npm run"
  "pnpm"
  "git status"
  "git diff"
  "git add"
  "git commit"
  "docker build"
)

CMD="$*"

for pref in "${ALLOWED_PREFIXES[@]}"; do
  if [[ "$CMD" == "$pref"* ]]; then
    exec "$@"
  fi
done

echo "Blocked command: $CMD"
exit 2
```

Make executable:

``` bash
chmod +x scripts/agent-allowed.sh
```

------------------------------------------------------------------------

## Key Domain Concepts

-   **Hike** --- GPS track, photos, elevation, polyline, geohash
-   **Track** --- distance, elevation, duration summaries
-   **Posts** --- social content
-   **Diet** --- USDA/UPC nutrition tracking (web only)

------------------------------------------------------------------------

## TL;DR

Agents may:

-   Auto-run safe commands
-   Push to `agent/*`
-   Open PRs

Agents must not:

-   Merge to `main`
-   Run destructive or production commands without approval
-   Commit secrets
