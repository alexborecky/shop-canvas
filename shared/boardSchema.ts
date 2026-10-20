/**
 * Shape of a board's Yjs document. Shared by client and server.
 *
 * This is the contract that outlives the canvas library: if we replace Excalidraw with our own
 * canvas later, the new renderer reads/writes these same maps (and can migrate element JSON).
 *
 *   doc.getMap('elements')  id -> element JSON (currently Excalidraw element format, incl. deleted
 *                           tombstones with isDeleted: true; `version` decides which edit wins)
 *   doc.getMap('files')     fileId -> FileMeta (bytes live in R2 at /api/files/:boardId/:fileId)
 *   doc.getMap('meta')      'name' -> board name (string)
 */
export const ELEMENTS_KEY = 'elements'
export const FILES_KEY = 'files'
export const META_KEY = 'meta'

export interface FileMeta {
	mimeType: string
	created: number
}

/** Party name for the Durable Object binding `Board` (partyserver kebab-cases binding names). */
export const PARTY = 'board'
