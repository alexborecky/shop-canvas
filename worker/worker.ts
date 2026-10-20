import { AutoRouter, error, IRequest } from 'itty-router'
import { routePartykitRequest } from 'partyserver'
import { handleFileDownload, handleFileUpload } from './files'

// Durable Object classes must be exported from the worker entry point.
export { BoardServer } from './BoardServer'

const router = AutoRouter<IRequest, [env: Env, ctx: ExecutionContext]>({
	catch: (e) => {
		console.error(e)
		return error(e)
	},
})
	// Image upload/download (R2)
	.post('/api/files/:boardId/:fileId', handleFileUpload)
	.get('/api/files/:boardId/:fileId', handleFileDownload)
	.all('*', () => error(404))

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		// Realtime sync: /parties/board/:boardId (websocket) goes to that board's Durable Object.
		// Handled before itty-router because partyserver needs the raw Request object.
		if (new URL(request.url).pathname.startsWith('/parties/')) {
			return (await routePartykitRequest(request, env)) ?? new Response('Not found', { status: 404 })
		}
		return router.fetch(request, env, ctx)
	},
} satisfies ExportedHandler<Env>
