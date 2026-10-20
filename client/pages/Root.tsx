import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { uniqueId } from 'tldraw'
import { getRecentBoards } from '../recentBoards'

/** Landing page: create a new board or reopen a recent one. */
export function Root() {
	const navigate = useNavigate()
	const [recent] = useState(getRecentBoards)

	return (
		<div className="Home">
			<h1>Shoptet Canvas</h1>
			<p>Multiplayer board for stickies, rectangles, text and images.</p>
			<button className="Home-new" onClick={() => navigate(`/b/${uniqueId()}`)}>
				New board
			</button>
			{recent.length > 0 && (
				<>
					<h2>Recent boards</h2>
					<ul>
						{recent.map((b) => (
							<li key={b.id}>
								<a href={`/b/${b.id}`}>{b.id}</a>
								<span>{new Date(b.openedAt).toLocaleString()}</span>
							</li>
						))}
					</ul>
				</>
			)}
		</div>
	)
}
