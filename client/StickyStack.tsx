/** The "+ sticky" button, drawn as a Miro-style pad of sticky notes with a curled top sheet. */
export function StickyStack({ onClick }: { onClick: () => void }) {
	return (
		<button className="StickyStack" onClick={onClick} title="Sticky note (S)" aria-label="Add sticky note (S)">
			<span className="StickyStack-base" />
			<span className="StickyStack-under" />
			<span className="StickyStack-top" />
		</button>
	)
}
