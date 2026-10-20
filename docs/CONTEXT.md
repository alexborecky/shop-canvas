# Context & decisions

## What we're building

A multiplayer board with mostly stickies, rectangles and text, plus image import.
Not needed: export, sharing permissions, comments, templates. "Just canvas, a couple of shapes and stickies."

## Why not just Miro

Miro is already paid for. The reasoning for building anyway is a narrow, simple board — and a
throwaway-friendly playground for canvas-style editing ideas (selection models, contextual toolbars).
Rebuilding "Miro but simpler" in general would mean rebuilding Miro's boring parts and still losing.

## Options considered

| Route | Effort | Notes |
|---|---|---|
| **tldraw + tldraw sync (chosen)** | ½ day prototype, 2–3 days polished | Canvas, stickies, rects, text, selection, undo, cursors, sync, persistence, image upload all included. Work is mostly *removal*. **Licence needed for production.** |
| Excalidraw | few more days | MIT. Collab server is separate with simpler conflict handling; stickies less native. |
| Konva + Yjs from scratch | 1–2 weeks to feel decent | Only if we want full control of the interaction model. |

## Known effort sinks

- **Images** are the only real backend work → R2 upload, sync only the URL. Template handles it.
- **"No permissions" still needs a door** → Cloudflare Access with company SSO in front of the worker.
  Config, not code. Without it, anyone with a board URL can edit.
- **Persistence & recovery** → DO SQLite persists rooms; per-session undo covers most mistakes.
  A periodic per-room snapshot (e.g. to R2) is cheap insurance against select-all-delete. *Not built yet.*
- Canvas interaction details (zoom around cursor, hit-testing, snapping, text auto-size) are where
  from-scratch builds lose time. tldraw already solves these — don't fight it.

## Status

- [x] Scaffold from tldraw `multiplayer` starter (tldraw 5.5.x)
- [x] Toolbar reduced to select, hand, sticky, rectangle, text, image, eraser; other shortcuts disabled
- [x] Home page with New board + recent boards; boards at `/b/:id`
- [x] Verified locally: two clients see each other's shapes and presence
- [ ] Get tldraw licence key (or confirm terms for internal use)
- [ ] Create Cloudflare account resources (R2 bucket `shoptet-canvas-uploads`), deploy
- [ ] Put Cloudflare Access (SSO) in front
- [ ] Nightly room snapshots
- [ ] Styling / branding pass
