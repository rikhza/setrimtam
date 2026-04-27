# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development commands

- Install deps: `npm install`
- Start dev server: `npm run dev`
- Typecheck only: `npm run typecheck`
- Build (TypeScript + Vite): `npm run build`
- Full local check before PR: `npm run check`
- Preview production build locally: `npm run preview`
- Deploy static build to Cloudflare Pages: `npm run pages:deploy`

### Tooling/runtime assumptions

- Node.js `>=20` is required (`package.json` engines).
- This repo includes both `bun.lock` and `package-lock.json`, but npm scripts are the canonical workflow in README/package scripts.

## Test and validation status

- There is currently no dedicated test runner/script in `package.json`.
- For code changes, validate with:
  1. `npm run typecheck`
  2. `npm run build`
  3. Manual browser verification for affected tools (`/tools/stream`, `/tools/fmv`, `/tools/julian`).

## High-level architecture

Setrimtam is a client-only React + TypeScript SPA (Vite + React Router) for mainframe-style data tooling.

### Route/layout model

- `src/App.tsx` defines routes under a shared `Layout`:
  - `/tools/stream` (copybook -> stream generation)
  - `/tools/fmv` (raw stream -> field map view)
  - `/tools/julian` (date conversion utility)
- `src/components/Layout.tsx` owns global shell concerns:
  - shared header/footer
  - a `registerClearAll` outlet context so each tool page can register its own clear/reset behavior.

### Core domain layer (shared parser + stream engine)

- `src/lib/cobolParser.ts` is the core domain module used by both Stream Builder and FMV.
- Key responsibilities:
  - parse COBOL copybook lines into `CobolField[]`
  - support PIC parsing, OCCURS expansion, REDEFINES, FILLER handling, 88-level conditions metadata
  - detect COMP-3 fields and model both:
    - physical byte length (`length`)
    - logical stream character length (`charLength`, hex chars for COMP-3)
  - build generated stream output (`buildStream`) and field-level breakdown metadata
  - map raw pasted streams back to per-field values (`rawStreamToFieldValues` / `sliceRawStreamToBreakdown`)
  - produce hex output with encoding awareness (`buildStreamHex`).

This byte-vs-char distinction is central: UI offsets and hover labels may display byte offset and char offset separately for COMP-3 fields.

### Page-level data flows

#### Stream Builder (`src/pages/StreamBuilderPage.tsx`)

1. Parse copybook -> `parsedFields`.
2. Build editable form state for non-FILLER fields.
3. Generate output stream and breakdown via `buildStream`.
4. Render output in `StreamOutputPanel`:
   - segmented raw stream
   - copybook map
   - terminal preview (24x80)
   - clipboard copy (raw and hex).

It also supports reverse-fill from raw pasted stream into form values via `rawStreamToFieldValues`.

#### FMV (`src/pages/FmvPage.tsx`)

1. Parse copybook -> `parsedFields`.
2. Normalize raw input (`normalizeRawStreamForLayout`) to remove line breaks.
3. Slice raw stream into layout-aligned `breakdown` via `sliceRawStreamToBreakdown`.
4. Render one-row pivot-style mapped output in `FmvOutputPanel`, including COMP-3 decode display where possible.

### Persistence model (browser only)

- `src/lib/toolLocalStorage.ts` handles all persistence and is intentionally browser-local.
- Two persistence layers per tool:
  - auto-restored draft state
  - optional named snapshots shown in `ToolSavesDock`.
- Named saves are capped at 40 entries per tool (`MAX_NAMED_SAVES`).
- Storage keys are namespaced with `setrimtam:v1:*`.

### UI composition patterns

- Pages orchestrate state + parser interactions.
- Components under `src/components/` are mostly presentational/tool-panel UI.
- Cross-tool UX patterns reused across stream/fmv:
  - toast notifications (`useToast`, `ToastContainer`)
  - named saves drawer (`ToolSavesDock`)
  - tool-specific clear handlers registered through layout context.

## Deployment notes

- `wrangler.toml` is configured for static asset deploys from `dist/`.
- `not_found_handling = "single-page-application"` is required for client-side routing fallback behavior on Cloudflare Pages.
