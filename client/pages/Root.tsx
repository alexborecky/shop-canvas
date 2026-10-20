import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRecentBoards } from '../recentBoards'

/** Landing page: create a new board or reopen a recent one. */
export function Root() {
	const navigate = useNavigate()
	const [recent] = useState(getRecentBoards)

	return (
		<div className="Home">
			<h1>Shoptet Canvas</h1>
			<p>Multiplayer board for stickies, rectangles, text and images.</p>
			<button className="Home-new" onClick={() => navigate(`/b/${newBoardId()}`)}>
				New board
			</button>
			{recent.length > 0 && (
				<>
					<h2>Recent boards</h2>
					<ul>
						{recent.map((b) => (
							<li key={b.id}>
								<a href={`/b/${b.id}`}>{b.name || b.id}</a>
								<span>{new Date(b.openedAt).toLocaleString()}</span>
							</li>
						))}
					</ul>
				</>
			)}
		</div>
	)
}

/** 16 random url-safe chars (~95 bits): unguessable enough that links act as the "key". */
function newBoardId() {
	const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
	const bytes = crypto.getRandomValues(new Uint8Array(16))
	return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}
