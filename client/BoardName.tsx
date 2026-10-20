import { useEffect, useRef, useState } from 'react'
import { Editor, useValue } from 'tldraw'
import { rememberBoard } from './recentBoards'

export const UNTITLED = 'Untitled board'

/**
 * Editable board name in the header.
 * Stored in the tldraw document record (editor.getDocumentSettings().name), so it is
 * persisted by the Durable Object and synced live to everyone on the board.
 */
export function BoardName({ editor, roomId }: { editor: Editor; roomId: string }) {
	const name = useValue('board name', () => editor.getDocumentSettings().name, [editor])
	const [draft, setDraft] = useState(name)
	const [editing, setEditing] = useState(false)
	const cancelled = useRef(false)

	// keep the local draft in sync with remote renames while not editing
	useEffect(() => {
		if (!editing) setDraft(name)
	}, [name, editing])

	// cache the name for the home page's recent list
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
		if (next !== name) editor.updateDocumentSettings({ name: next })
	}

	return (
		<input
			className="BoardName"
			value={editing ? draft : name}
			placeholder={UNTITLED}
			aria-label="Board name"
			maxLength={120}
			onFocus={() => setEditing(true)}
			onChange={(e) => setDraft(e.target.value)}
			onBlur={commit}
			onKeyDown={(e) => {
				// stop tldraw shortcuts firing while typing
				e.stopPropagation()
				if (e.key === 'Enter') e.currentTarget.blur()
				if (e.key === 'Escape') {
					cancelled.current = true
					e.currentTarget.blur()
				}
			}}
		/>
	)
}
