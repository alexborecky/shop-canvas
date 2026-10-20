# Shoptet Canvas

A small multiplayer whiteboard: stickies, rectangles, text and images.
Built entirely on open-source pieces — [Excalidraw](https://github.com/excalidraw/excalidraw) (MIT),
[Yjs](https://yjs.dev) (MIT), [y-partyserver](https://github.com/cloudflare/partykit) (ISC) — and runs on
Cloudflare Workers. No licence keys, no paid SDKs.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173, click **New board**, then open the same URL in a second window to see multiplayer.

- **Sticky:** `+ Sticky` button or press `N`; select it and press Enter (or double-click) to type
- **Rectangle** `R` · **Text** `T` or double-click canvas · **Image** `9`, or drag & drop / paste
- Rename the board by clicking its name in the header; set your cursor name top-right

## Deploy (Cloudflare)

1. `npx wrangler login`
2. Create the image bucket: `npx wrangler r2 bucket create shoptet-canvas-uploads`
3. `npm run deploy`
4. Optional: custom domain in `wrangler.toml` (`[[routes]]` block)
5. Put **Cloudflare Access** (Zero Trust → Access → Applications) in front with company SSO

Free Cloudflare plan is enough to start.

## Docs

- `CLAUDE.md` — working instructions for Claude / AI coding tools
- `docs/CONTEXT.md` — decisions, data storage, status

`LICENSE.md` is the MIT licence of the tldraw sync template this repo started from (a little of its
worker scaffolding remains). The earlier tldraw-based prototype is kept at git tag `tldraw-prototype`.
