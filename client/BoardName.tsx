import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type * as Y from 'yjs'
import { META_KEY } from '../shared/boardSchema'
import { rememberBoard } from './recentBoards'

export const UNTITLED = 'Untitled'

/** Reactive read of the board name from the shared document (doc.getMap('meta').get('name')). */
function useBoardName(doc: Y.Doc) {
	const meta = doc.getMap<string>(META_KEY)
	return useSyncExternalStore(
		(cb) => {
			meta.observe(cb)
			return () => meta.unobserve(cb)
		},
		() => meta.get('name') ?? ''
	)
}

/**
 * Editable board name in the top-left toolbar. Stored in the board's Yjs document, so it is persisted
 * with the board and synced live to everyone on it.
 */
export function BoardName({ doc, roomId }: { doc: Y.Doc; roomId: string }) {
	const name = useBoardName(doc)
	const [draft, setDraft] = useState(name)
	const [editing, setEditing] = useState(false)
	const cancelled = useRef(false)

	useEffect(() => {
		if (!editing) setDraft(name)
	}, [name, editing])

	useEffect(() => {
		if (name) rememberBoard(roomId, name)
	}, [roomId, name])

	useEffect(() => {
		document.title = `${name || UNTITLED} · Shoptet Canvas`
	}, [name])

	const commit = () => {
		setEditing(false)
		if (cancelled.current) {
			cancelled.current = false
			setDraft(name)
			return
		}
		const next = draft.trim()
		if (next !== name) doc.getMap<string>(META_KEY).set('name', next)
	}

	const shown = editing ? draft : name

	return (
		// the hidden copy of the text sizes the input to its content
		<span className="BoardName" data-value={shown || UNTITLED}>
			<input
				className="HeaderInput BoardName-input"
				value={shown}
				placeholder={UNTITLED}
				aria-label="Board name"
				maxLength={120}
				onFocus={() => setEditing(true)}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={commit}
				onKeyDown={(e) => {
					e.stopPropagation()
					if (e.key === 'Enter') e.currentTarget.blur()
					if (e.key === 'Escape') {
						cancelled.current = true
						e.currentTarget.blur()
					}
				}}
			/>
		</span>
	)
}
