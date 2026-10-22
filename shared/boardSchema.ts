/**
 * Shape of a board's Yjs document. Shared by client and server.
 *
 * This is the contract that outlives the canvas library: if we replace Excalidraw with our own
 * canvas later, the new renderer reads/writes these same maps (and can migrate element JSON).
 *
 *   doc.getMap('elements')  id -> element JSON (currently Excalidraw element format, incl. deleted
 *                           tombstones with isDeleted: true; `version` decides which edit wins).
 *                           Stickies are rectangles with customData { kind: 'sticky', author?: string },
 *                           author = creator's display name at creation time.
 *   doc.getMap('files')     fileId -> FileMeta (bytes live in R2 at /api/files/:boardId/:fileId)
 *   doc.getMap('meta')      'name' -> board name (string)
 *                           'background' -> canvas background colour (CSS colour string)
 *   doc.getMap('timer')     shared countdown, see TimerFields. Missing map = idle at 5:00 (older boards).
 *                           Clients count down locally from `endsAt` (server-corrected clock);
 *                           the doc is written only on user actions. Every write sets ALL fields
 *                           (null where unused, never delete): Yjs merges concurrent writes per
 *                           key, and only full writes guarantee one of them wins as a whole.
 *                           Not part of any undo history: an UndoManager, if ever added, should
 *                           track `elements` only.
 */
export const ELEMENTS_KEY = 'elements'
export const FILES_KEY = 'files'
export const META_KEY = 'meta'
export const TIMER_KEY = 'timer'

export interface FileMeta {
	mimeType: string
	created: number
}

export type TimerStatus = 'idle' | 'running' | 'paused'

export interface TimerFields {
	status: TimerStatus
	/** the last duration set on this board; the setup state starts from it */
	durationMs: number
	/** epoch ms (server clock) when it hits zero; set while running */
	endsAt: number | null
	/** frozen remaining time; set while paused */
	remainingMs: number | null
	/** epoch ms (server clock) of the last write */
	updatedAt: number
}

/** Party name for the Durable Object binding `Board` (partyserver kebab-cases binding names). */
export const PARTY = 'board'
