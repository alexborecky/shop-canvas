import { useEffect, useRef, useState } from 'react'
import { initials } from './Collaborators'
import type { Identity } from './identity'

/** Your own avatar in the top-right toolbar; click it to change your name (cursor + sticky signature). */
export function MyAvatar({ identity, onRename }: { identity: Identity; onRename: (name: string) => void }) {
	const [open, setOpen] = useState(false)
	const [draft, setDraft] = useState(identity.name)
	const root = useRef<HTMLDivElement>(null)
	const trimmed = draft.trim()

	const close = (save: boolean) => {
		if (save && trimmed && trimmed !== identity.name) onRename(trimmed)
		setOpen(false)
	}

	const closeRef = useRef(close)
	closeRef.current = close

	useEffect(() => {
		if (!open) return
		setDraft(identity.name)
		// clicking anywhere else saves, like leaving a form field
		const onPointerDown = (e: PointerEvent) => {
			if (!root.current?.contains(e.target as Node)) closeRef.current(true)
		}
		window.addEventListener('pointerdown', onPointerDown)
		return () => window.removeEventListener('pointerdown', onPointerDown)
	}, [open, identity.name])
	return (
		<div className="MyAvatar" ref={root}>
			<button
				className="Collaborators-avatar MyAvatar-button"
				style={{ background: identity.color.stroke }}
				title={`You (${identity.name || 'Anonymous'})`}
				aria-label="Your name"
				aria-expanded={open}
				onClick={() => (open ? close(true) : setOpen(true))}
			>
				{initials(identity.name)}
			</button>
			{open && (
				<form
					className="MyAvatar-popover"
					role="dialog"
					aria-label="Your name"
					onKeyDown={(e) => {
						e.stopPropagation() // keep Excalidraw shortcuts out of the input
						if (e.key === 'Escape') close(false)
					}}
					onSubmit={(e) => {
						e.preventDefault()
						close(true)
					}}
				>
					<label className="MyAvatar-label" htmlFor="MyAvatar-name">
						Your name
					</label>
					<input
						id="MyAvatar-name"
						className="HeaderInput MyAvatar-input"
						value={draft}
						maxLength={40}
						autoFocus
						onFocus={(e) => e.currentTarget.select()}
						onChange={(e) => setDraft(e.target.value)}
					/>
					<div className="MyAvatar-hint">Shown on your cursor and on the stickies you add.</div>
					<button className="MyAvatar-save" disabled={!trimmed}>
						Save
					</button>
				</form>
			)}
		</div>
	)
}
