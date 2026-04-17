# Setrimtam

Repository: [github.com/rikhza/setrimtam](https://github.com/rikhza/setrimtam)

Browser-based utilities for mainframe-style development workflows. Parse COBOL copybooks, build and inspect VTAM-style streams, and work with Julian ordinal dates. Everything runs **in your browser**; copybooks and payloads stay on your machine (with optional persistence in `localStorage` for convenience).

## Features

- **Stream builder** — Parse a COBOL `INBOUND-MESSAGE` style copybook, fill fields, and generate stream output (including hex) for CICS / VTAM-style testing.
- **FMV (field map view)** — Paste raw stream data alongside a copybook to slice it into a field-by-field breakdown, with warnings when layout and data disagree.
- **Julian date** — Convert between calendar dates and ordinal Julian forms (`YYDDD` / `YYYYDDD`).
- **Operator-console aesthetic** — Retro terminal UI for a focused working environment.

## Tech stack

- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite 5](https://vitejs.dev/) for dev server and production builds
- [React Router](https://reactrouter.com/) for client-side routing

## Requirements

- **Node.js** 20 or newer (see `engines` in `package.json`)

## Getting started

Clone the repository, install dependencies, and start the dev server:

```bash
git clone https://github.com/rikhza/setrimtam.git
cd setrimtam
npm install
npm run dev
```

Then open the URL Vite prints (typically `http://localhost:5173`).

### Scripts

| Command | Description |
| -------- | ----------- |
| `npm run dev` | Start Vite in development mode |
| `npm run build` | Typecheck and produce a production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Run the TypeScript compiler without emitting files |
| `npm run check` | Run `typecheck` then `build` (useful before opening a PR) |
| `npm run pages:deploy` | Deploy `dist/` to [Cloudflare Pages](https://pages.cloudflare.com/) via Wrangler (requires Cloudflare login and project setup) |

## Project layout

- `src/pages/` — Top-level routes (home, stream builder, FMV, Julian date).
- `src/components/` — Shared UI (layout, panels, mainframe chrome).
- `src/lib/` — Parsing, stream logic, date math, and browser persistence helpers.

## Contributing

Contributions are welcome. A smooth review usually looks like this:

1. **Open an issue first** for larger changes (new tools, parser behavior, or UX overhauls) so we can agree on direction.
2. **Fork the repository** and create a branch from the default branch.
3. **Keep changes focused** — one logical concern per pull request makes review and rollback easier.
4. **Run checks locally** before you push:

   ```bash
   npm run check
   ```

5. **Describe your PR clearly** — what problem it solves, how you tested it, and any trade-offs you considered.

### Guidelines

- Match existing **TypeScript strictness**, formatting, and component patterns.
- Prefer **client-side only** solutions unless there is an explicit project decision to add a backend.
- Do not commit secrets, API keys, or production copybooks with sensitive data.
- If you add user-visible strings, keep them clear; the app UI may mix English and other languages—follow the tone of surrounding copy.

### Code of conduct

Be respectful and constructive in issues and pull requests. Assume good intent, stay on topic, and help keep the project welcoming for newcomers.

## Privacy

Setrimtam does not send your copybooks or stream data to a server as part of the core app flow. Named saves and draft state for some tools may be stored in your browser’s `localStorage` under keys prefixed with `setrimtam:` (see `src/lib/toolLocalStorage.ts`). Clear site data in your browser if you want to remove that.

## License

This repository does not yet include a `LICENSE` file. If you intend to redistribute or package the project, confirm licensing with the maintainers or add an explicit license as part of your contribution.

---

Questions, ideas, and pull requests are welcome on the repository where this project is hosted.
