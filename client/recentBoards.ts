import { getLocalStorageItem, setLocalStorageItem } from './localStorage'

const KEY = 'shoptet-canvas:recent-boards'
const MAX = 20

export interface RecentBoard {
	id: string
	openedAt: number
}

/** Per-browser list of boards you've opened. Not shared, not authoritative. */
export function getRecentBoards(): RecentBoard[] {
	try {
		return JSON.parse(getLocalStorageItem(KEY) ?? '[]')
	} catch {
		return []
	}
}

export function rememberBoard(id: string) {
	const next = [{ id, openedAt: Date.now() }, ...getRecentBoards().filter((b) => b.id !== id)]
	setLocalStorageItem(KEY, JSON.stringify(next.slice(0, MAX)))
}
