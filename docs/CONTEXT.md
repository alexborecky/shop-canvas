# Context & decisions

## What we're building

A multiplayer board with mostly stickies, rectangles and text, plus image import.
Not needed: export, sharing permissions, comments, templates. "Just canvas, a couple of shapes and stickies."
Hard requirement: **our own thing, no paywall / licence keys.**

## Why not just Miro

Miro is already paid for. The reasoning for building anyway is a narrow, simple board we fully own —
and a playground for canvas-style editing ideas (selection models, contextual toolbars).

## Decision log

1. **Started on tldraw + tldraw sync** (fastest route). Dropped: tldraw SDK needs a commercial licence
   for any production domain (the editor refuses to render unlicensed on https). Hobby licence doesn't
   fit company use; commercial pricing is quote-only. The prototype is kept in git as tag `tldraw-prototype`.
2. **Now: Excalidraw + Yjs, our own sync server** (option 1). All MIT/ISC. Excalidraw gives a polished
   canvas; we own the sync, storage and data format.
3. **Later, maybe: our own canvas (Konva + Yjs)** (option 2). The Yjs document shape and the server
   are renderer-agnostic, so swapping the renderer doesn't lose boards. Do this if Excalidraw's look or
   interaction model gets in the way.

## Options considered

| Route | Effort | Notes |
|---|---|---|
| tldraw + sync | ½ day | Best out of the box, but **licence required for production**. Rejected. |
| **Excalidraw + Yjs (chosen)** | 2–4 days | MIT. No native stickies (we make them: yellow rectangle + bound text). Hand-drawn look toned down via defaults. |
| Konva + Yjs from scratch | 1–2 weeks to feel decent | Full control. Possible next step. |

## Costs (all free at our size)

- Code: Excalidraw MIT, Yjs MIT, y-partyserver/partyserver ISC. "Excalidraw+" (their hosted SaaS) is not used.
- Cloudflare Workers Free plan includes SQLite Durable Objects (5 GB, 100k requests/day). Paid plan from $5/month if outgrown.
- R2: free up to 10 GB storage.

## How data is stored

- **Board content** (elements, board name): one Yjs document per board, held by that board's Durable
  Object and saved to its built-in SQLite (debounced ~2s, max 10s, and when the room empties).
  Stored as a chunked Yjs update in table `doc_chunks`.
- **Images**: R2 bucket `shoptet-canvas-uploads` at `files/<boardId>/<fileId>` (fileId = content hash).
  The doc's `files` map just records that the file exists + its mime type.
- **Recent boards on the home page** and **your display name**: browser localStorage only.
  There is no server-side list of boards — the URL is the only way back to a board.
- **Locally** (`npm run dev`): all of it is emulated in `.wrangler/state/`. Delete to reset.
- No backups yet.

## Known effort sinks / risks

- "No permissions" still needs a door → Cloudflare Access (SSO) in front. Board IDs are random and
  unguessable, but anyone with a link can edit.
- Select-all + delete: undo is per person. Nightly snapshots to R2 would be cheap insurance.
- Deleted-element tombstones accumulate in the doc; add pruning if boards get heavy.

## Status

- [x] Excalidraw + Yjs + Durable Object sync, SQLite persistence
- [x] Tools limited to select, hand, rectangle, text, image, eraser + **Sticky** button / `N`
- [x] Live cursors with names, selection highlights, laser pointer
- [x] Image upload to R2, synced to others, reload-safe
- [x] Board rename (synced), recent boards list, connection status dot
- [x] Fonts self-hosted, zero third-party requests at runtime
- [x] Verified: two browsers sync shapes/stickies/text/images/name; board survives everyone leaving; prod build works
- [ ] Deploy to Cloudflare + Cloudflare Access (SSO)
- [ ] Server-side board directory (list all boards)
- [ ] Nightly snapshots
- [ ] Sticky colours, styling/branding pass
- [ ] Disable shortcuts of hidden tools
