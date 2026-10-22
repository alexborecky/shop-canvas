# Shoptet Canvas — instructions for Claude

A deliberately small, multiplayer whiteboard: **stickies, basic shapes, arrows/lines, freehand, text, images**.
Fully open-source stack, no licence keys: **Excalidraw (MIT) + Yjs (MIT) + y-partyserver (ISC)**
on Cloudflare Workers / Durable Objects / R2. Read `docs/CONTEXT.md` before proposing architecture changes.

## Scope guardrails

- In scope: infinite canvas, stickies, shapes (rectangle/diamond/ellipse), arrows, lines, freehand, text, image import, live cursors/presence,
  per-board URLs, board names, a shared countdown timer.
- Out of scope unless asked: export, sharing/permissions UI, comments, templates, integrations,
  frames, embeds, mobile-specific work.
- Access control lives *outside* the app (Cloudflare Access + company SSO), not in code.
- No paid/licensed dependencies. Check a package's licence before adding it (MIT/ISC/Apache/BSD ok).
- No runtime calls to third-party CDNs (fonts are self-hosted; keep it that way).

## Architecture in one breath

Each board = one Durable Object (`worker/BoardServer.ts`) holding a **Yjs document**, persisted to
the DO's SQLite. Browsers connect over websocket (`/parties/board/:id`). Excalidraw renders the
board; `client/sync/bindExcalidraw.ts` is the *only* bridge between Excalidraw and Yjs.
Images go to R2 (`/api/files/:boardId/:fileId`); the doc stores only file metadata.

The Yjs document shape (`shared/boardSchema.ts`) is the long-term contract. It is designed so the
Excalidraw renderer can later be replaced by our own canvas (Konva or similar) without touching
the server or losing boards.

## Commands

- `npm install` — install deps (`.npmrc` sets legacy-peer-deps; a types-only peer conflict)
- `npm run dev` — Vite + local Worker/DO/R2 emulation at http://localhost:5173
- `npm run typecheck` — TypeScript check
- `npm run build` — typecheck + production build
- `npm run deploy` — build + `wrangler deploy`
- `npm run cf-typegen` — regenerate `worker-configuration.d.ts` after editing `wrangler.toml`

Test multiplayer locally by opening the same `/b/<id>` URL in two browser windows.
In dev, `window.excalidrawAPI` and `window.boardDoc` are exposed in the console for debugging.

## Layout

- `shared/boardSchema.ts` — Yjs doc keys (`elements`, `files`, `meta`, `timer`) — **the data contract**
- `worker/worker.ts` — entry: `/parties/*` → Durable Object (before itty-router, needs raw Request); `/api/files/*` → R2;
  `/api/time` → server clock
- `worker/BoardServer.ts` — per-board Yjs server + SQLite persistence (chunked)
- `worker/files.ts` — image upload/download, R2 + edge cache
- `client/main.tsx` — routes `/` (home) and `/b/:roomId` (board)
- `client/pages/Room.tsx` — board + the contents of its two floating toolbars (top-left: status, name next to the menu button; top-right: timer, avatars, copy link). No page header.
- `client/Board.tsx` — `<Excalidraw>` setup, hidden tools + toolbar-placement CSS, "N" for sticky; places Room's toolbars (`menuBar` portalled after the menu button, `toolbar` via `renderTopRightUI`)
- `client/boardConfig.ts` — **product scope**: hidden tools, UI options, default styles, sticky colours
- `client/stickies.ts` — sticky creation (yellow rectangle, `customData.kind = 'sticky'`)
- `client/sync/useBoardDoc.ts` — Y.Doc + websocket provider lifecycle
- `client/sync/bindExcalidraw.ts` — Excalidraw ⇄ Yjs binding, images, presence
- `client/sync/serverClock.ts` — `serverNow()`: clock offset to the server, estimated on connect (dev: `?skew=30` fakes a fast clock)
- `client/timer/useBoardTimer.ts` — shared countdown: reads/writes the `timer` map, ticks locally from `endsAt`; −/+ step rule
- `client/timer/TimerPanel.tsx` — toolbar timer button + the floating panel (setup / running)
- `client/timer/chime.ts` — Web Audio chime at zero
- `client/BoardName.tsx` — board name in `meta` map
- `client/identity.ts` — display name + cursor colour (localStorage)
- `client/MyAvatar.tsx` — your avatar (initials) in the top-right toolbar; click to rename
- `client/NamePrompt.tsx` — first-visit name modal; blurs and blocks the board (`inert`) until a name is given
- `scripts/copy-excalidraw-assets.mjs` — copies Excalidraw fonts to `public/fonts` (runs pre dev/build)

## Gotchas (learned the hard way)

- **Excalidraw mutates elements in place.** Always `structuredClone` when writing to or reading from
  Yjs, or edits silently stop syncing.
- **Excalidraw applies `initialData` after mount** and wipes the scene, so the binding does its real
  initial load on the first `onChange`.
- Conflict rule (same as Excalidraw's): higher `version` wins, tie → lower `versionNonce` wins.
- Deleted elements stay in the doc as tombstones (`isDeleted: true`). Fine for now; prune later if boards get big.
- Hidden tools (frames, embeds…) are hidden with CSS only; their keyboard shortcuts still work.
- partyserver maps binding name → URL: binding `Board` ⇒ `/parties/board/:id`. Don't use ALL_CAPS binding names.
- Durable Object class changes need a new `[[migrations]]` tag in `wrangler.toml` once deployed.
- **Timer writes set every field** of the `timer` map (null where unused, never `delete`). Yjs merges
  concurrent writes per key; partial writes could combine into an invalid state.
- Timer maths uses `serverNow()`, never `Date.now()`: laptop clocks are often off by seconds.
- Brand spelling: team.blue (lowercase).

## Conventions

- TypeScript strict, tabs, single quotes.
- Keep Excalidraw-specific code inside `client/Board.tsx`, `client/stickies.ts`, `client/boardConfig.ts`
  and `client/sync/bindExcalidraw.ts`. Everything else (incl. `client/timer/`) should be renderer-agnostic.
