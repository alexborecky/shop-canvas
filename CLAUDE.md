# Shoptet Canvas — instructions for Claude

A deliberately small, multiplayer whiteboard: **stickies, rectangles, text, images**. Nothing else.
Built on the tldraw SDK + tldraw sync, running on Cloudflare Workers / Durable Objects / R2.
Read `docs/CONTEXT.md` for why it's built this way before proposing architecture changes.

## Scope guardrails

- In scope: infinite canvas, sticky notes, rectangles, text, image import, live cursors/presence, per-board URLs.
- Explicitly OUT of scope (don't add unless asked): export, sharing/permissions UI, comments, templates,
  integrations, connectors/arrows, freehand drawing, mobile-specific work.
- Access control is handled *outside* the app (Cloudflare Access + company SSO), not in code.
- Prefer configuring tldraw over reimplementing it. If something feels like it needs a from-scratch
  canvas feature, check tldraw docs/examples first (https://tldraw.dev/examples).

## Commands

- `npm install` — install deps
- `npm run dev` — Vite + local Worker/Durable Object/R2 emulation at http://localhost:5173
- `npm run build` — typecheck + production build
- `npx wrangler deploy` — deploy (after `npm run build`)
- `npx tsc --noEmit` — typecheck only

Test multiplayer locally by opening the same `/b/<id>` URL in two browser windows.

## Layout

- `client/main.tsx` — routes: `/` (home) and `/b/:roomId` (a board)
- `client/pages/Root.tsx` — home: "New board" + recent boards (localStorage, per-browser)
- `client/pages/Room.tsx` — board page; wires `useSync` store into `<Tldraw>`
- `client/BoardName.tsx` — editable board name; stored via `editor.updateDocumentSettings({ name })`
- `client/boardConfig.tsx` — **the place to change which tools exist** (toolbar + shortcut stripping)
- `client/multiplayerAssetStore.tsx` — image upload/download client
- `worker/worker.ts` — routes: `/api/connect/:roomId` (websocket), `/api/uploads/:id`, `/api/unfurl`
- `worker/TldrawDurableObject.ts` — one instance per board; persists to DO SQLite
- `worker/assetUploads.ts` — R2 upload/download
- `wrangler.toml` — Cloudflare config (worker name, DO binding, R2 bucket, optional custom domain)

## Conventions

- TypeScript strict, tabs, single quotes (matches template).
- Keep custom code in clearly named files (`boardConfig.tsx`, etc.) rather than scattering edits
  through template files — makes tldraw template upgrades easier.
- Custom shapes: must be registered on BOTH client (`<Tldraw shapeUtils>` / `useSync`) and server
  schema in `TldrawDurableObject.ts`, or sync will reject them.
- Changing Durable Object classes requires a new `[[migrations]]` entry in `wrangler.toml`.

## Gotchas

- **tldraw licence**: works on localhost without a key; any deployed domain needs
  `VITE_TLDRAW_LICENSE_KEY` (see `.env.example`). Check https://tldraw.dev/pricing — don't assume
  internal use is free.
- Hidden tools still had keyboard shortcuts; `boardOverrides` strips them. If you add a tool back,
  add it to `ALLOWED_TOOLS` and to the toolbar.
- Images never go in the synced document — upload to R2, sync only the URL (template already does this).
- Brand spelling: team.blue (lowercase).
