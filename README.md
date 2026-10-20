# Shoptet Canvas

A small multiplayer whiteboard: stickies, rectangles, text and images. Built on
[tldraw](https://tldraw.dev) + tldraw sync and runs on Cloudflare Workers.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173, click **New board**, then open the same URL in a second window to see multiplayer.

## Deploy (Cloudflare)

1. `npx wrangler login`
2. Create the image bucket: `npx wrangler r2 bucket create shoptet-canvas-uploads`
3. Copy `.env.example` → `.env` and set `VITE_TLDRAW_LICENSE_KEY` (required off localhost)
4. `npm run build && npx wrangler deploy`
5. Optional: set a custom domain in `wrangler.toml` (`[[routes]]` block)
6. Put **Cloudflare Access** (Zero Trust → Access → Applications) in front of the domain with company SSO

## Docs

- `CLAUDE.md` — working instructions for Claude / AI coding tools
- `docs/CONTEXT.md` — why it's built this way, scope, status
- `docs/TEMPLATE_README.md` — original tldraw sync template README (architecture details)

Template code is MIT (`LICENSE.md`); the tldraw SDK is under the [tldraw license](https://github.com/tldraw/tldraw/blob/main/LICENSE.md).
