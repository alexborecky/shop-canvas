import { error, IRequest } from 'itty-router'

/**
 * Images live in R2, never in the synced document. The document only references them by fileId.
 * Key layout: files/<boardId>/<fileId>
 */
declare global {
	interface CacheStorage {
		default: Cache
	}
}

const MAX_BYTES = 10 * 1024 * 1024
const SAFE_ID = /^[a-zA-Z0-9_-]{1,128}$/

function objectKey(request: IRequest) {
	const { boardId, fileId } = request.params
	if (!SAFE_ID.test(boardId) || !SAFE_ID.test(fileId)) return null
	return `files/${boardId}/${fileId}`
}

export async function handleFileUpload(request: IRequest, env: Env) {
	const key = objectKey(request)
	if (!key) return error(400, 'Invalid id')

	const contentType = request.headers.get('content-type') ?? ''
	if (!contentType.startsWith('image/')) return error(400, 'Only images are allowed')

	const length = Number(request.headers.get('content-length') ?? 0)
	if (length > MAX_BYTES) return error(413, 'Image too large (max 10 MB)')

	// fileIds are content hashes, so an existing object is the same image: treat as success.
	if (await env.BOARD_FILES.head(key)) return { ok: true }

	await env.BOARD_FILES.put(key, request.body, { httpMetadata: { contentType } })
	return { ok: true }
}

export async function handleFileDownload(request: IRequest, env: Env, ctx: ExecutionContext) {
	const key = objectKey(request)
	if (!key) return error(400, 'Invalid id')

	const cacheKey = new Request(request.url)
	const cached = await caches.default.match(cacheKey)
	if (cached) return cached

	const object = await env.BOARD_FILES.get(key)
	if (!object) return error(404)

	const headers = new Headers()
	object.writeHttpMetadata(headers)
	headers.set('etag', object.httpEtag)
	// Files are immutable (content-addressed), cache forever.
	headers.set('cache-control', 'public, max-age=31536000, immutable')

	const response = new Response(object.body, { headers })
	ctx.waitUntil(caches.default.put(cacheKey, response.clone()))
	return response
}
