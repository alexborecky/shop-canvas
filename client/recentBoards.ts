import { getLocalStorageItem, setLocalStorageItem } from './localStorage'

const KEY = 'shoptet-canvas:recent-boards'
const MAX = 20

export interface RecentBoard {
	id: string
	/** Last name we saw for this board. Cached locally; the real name lives in the board document. */
	name?: string
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

export function rememberBoard(id: string, name?: string) {
	const prev = getRecentBoards()
	const existing = prev.find((b) => b.id === id)
	const entry = { id, name: name ?? existing?.name, openedAt: Date.now() }
	const next = [entry, ...prev.filter((b) => b.id !== id)]
	setLocalStorageItem(KEY, JSON.stringify(next.slice(0, MAX)))
}
