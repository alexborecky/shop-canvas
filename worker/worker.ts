import { AutoRouter, error, IRequest, json } from 'itty-router'
import { routePartykitRequest } from 'partyserver'
import { handleFileDownload, handleFileUpload } from './files'

// Durable Object classes must be exported from the worker entry point.
export { BoardServer } from './BoardServer'

// Production: board data is created and stored only in Cloudflare's EU region (GDPR).
// Must stay fixed once boards exist — changing it later points to different (empty) objects.
// Local dev: the workerd simulator doesn't implement jurisdictions, so it's off there.
const BOARD_JURISDICTION = import.meta.env.PROD ? 'eu' : undefined

const router = AutoRouter<IRequest, [env: Env, ctx: ExecutionContext]>({
	catch: (e) => {
		console.error(e)
		return error(e)
	},
})
	// Image upload/download (R2)
	.post('/api/files/:boardId/:fileId', handleFileUpload)
	.get('/api/files/:boardId/:fileId', handleFileDownload)
	// Server clock, so clients can agree on when a shared timer ends
	.get('/api/time', () => json({ now: Date.now() }, { headers: { 'Cache-Control': 'no-store' } }))
	.all('*', () => error(404))

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		// Realtime sync: /parties/board/:boardId (websocket) goes to that board's Durable Object.
		// Handled before itty-router because partyserver needs the raw Request object.
		if (new URL(request.url).pathname.startsWith('/parties/')) {
			const res = await routePartykitRequest(request, env, { jurisdiction: BOARD_JURISDICTION })
			return res ?? new Response('Not found', { status: 404 })
		}
		return router.fetch(request, env, ctx)
	},
} satisfies ExportedHandler<Env>
