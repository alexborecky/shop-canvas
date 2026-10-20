// Copies Excalidraw's font files into public/fonts so the app serves them itself
// (instead of Excalidraw's default public CDN). Runs automatically before dev/build.
import { cpSync, existsSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = fileURLToPath(new URL('../node_modules/@excalidraw/excalidraw/dist/prod/fonts', import.meta.url))
const dest = fileURLToPath(new URL('../public/fonts', import.meta.url))

if (!existsSync(src)) {
	console.error('Excalidraw fonts not found — run npm install first.')
	process.exit(1)
}
rmSync(dest, { recursive: true, force: true })
cpSync(src, dest, { recursive: true })
console.log('Copied Excalidraw fonts to public/fonts')
