import { useState } from 'react'

/**
 * First-visit name modal. The name signs your cursor and the stickies you add, so the board stays
 * covered (blurred, inert) until you give one; there is no skip.
 */
export function NamePrompt({ onSave }: { onSave: (name: string) => void }) {
	const [name, setName] = useState('')
	const trimmed = name.trim()

	return (
		<div className="NamePrompt-backdrop">
			<form
				className="NamePrompt"
				role="dialog"
				aria-modal="true"
				aria-labelledby="NamePrompt-title"
				onKeyDown={(e) => e.stopPropagation()} // keep Excalidraw shortcuts out of the input
				onSubmit={(e) => {
					e.preventDefault()
					if (trimmed) onSave(trimmed)
				}}
			>
				<div className="NamePrompt-title" id="NamePrompt-title">
					What's your name?
				</div>
				<div className="NamePrompt-hint">Shown on your cursor and on the stickies you add.</div>
				<input
					className="HeaderInput NamePrompt-input"
					placeholder="Your name"
					aria-label="Your name"
					value={name}
					maxLength={40}
					autoFocus
					onChange={(e) => setName(e.target.value)}
				/>
				<button className="NamePrompt-save" disabled={!trimmed}>
					Continue
				</button>
			</form>
		</div>
	)
}
