# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### quran-qaloon (تسميع القرآن - قالون عن نافع)

React + Vite web app for Quran recitation and tajweed checking.

**Key files:**
- `src/data/surahs.ts` — 114 surahs, 8 Qira'at, 16 reciters with audio CDN URLs
- `src/hooks/useAudio.ts` — HTML Audio element hook (play/pause/seek/volume/rate/retryKey)
- `src/hooks/useSpeechRecognition.ts` — Web Speech API hook (ar-SA, interim results, word comparison)
- `src/hooks/useListeningProgress.ts` — per-surah listening progress in localStorage
- `src/hooks/useKhatma.ts` — Khatma tracking in localStorage
- `src/components/AudioPlayer.tsx` — full audio player with retry, volume, speed, progress
- `src/components/TajweedChecker.tsx` — per-ayah mic button, word-by-word scoring
- `src/pages/Home.tsx` — surah list with khatma widget, athkar, filter
- `src/pages/SurahPlayer.tsx` — dual-tab (text/recite), qira'ah+reciter selector, audio player
- `src/pages/SearchPage.tsx` — ayah search with expandable context (before/after ayah)
- `src/pages/AthkarPage.tsx` — 6 athkar categories

**Audio CDN pattern:** `${reciter.audioBaseUrl}${paddedSurahNum3}.mp3`
- Default qira'ah: `qaloon`, default reciter: `qaloon-nafi`
- Persisted in localStorage: `quran_qirah`, `quran_reciter`

**Text API:** `https://api.alquran.cloud/v1/surah/${num}/quran-uthmani`
**Search API:** `https://api.alquran.cloud/v1/search/${query}/all/quran-uthmani`
**Context API:** `https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/quran-uthmani`
