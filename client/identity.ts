import { getLocalStorageItem, setLocalStorageItem } from './localStorage'

/**
 * Who you are on a board: a display name + cursor colour, remembered per browser.
 * No accounts — real identity comes from the SSO gate in front of the app.
 */
export interface Identity {
	name: string
	color: { background: string; stroke: string }
}

const KEY = 'shoptet-canvas:identity'

const COLORS = ['#e03131', '#2f9e44', '#1971c2', '#f08c00', '#9c36b5', '#0c8599', '#e8590c', '#5f3dc4']

function randomColor() {
	const stroke = COLORS[Math.floor(Math.random() * COLORS.length)]
	return { background: stroke + '33', stroke }
}

export function getIdentity(): Identity {
	try {
		const saved = JSON.parse(getLocalStorageItem(KEY) ?? 'null') as Identity | null
		if (saved?.name && saved.color) return saved
	} catch {
		// fall through
	}
	const identity = { name: '', color: randomColor() }
	setLocalStorageItem(KEY, JSON.stringify(identity))
	return identity
}

export function setIdentityName(name: string): Identity {
	const identity = { ...getIdentity(), name: name.trim() }
	setLocalStorageItem(KEY, JSON.stringify(identity))
	return identity
}
