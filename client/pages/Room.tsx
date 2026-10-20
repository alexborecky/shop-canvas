import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Board } from '../Board'
import { BoardName } from '../BoardName'
import { Collaborators } from '../Collaborators'
import { getIdentity, Identity, setIdentityName } from '../identity'
import { rememberBoard } from '../recentBoards'
import { ConnectionStatus, useBoardDoc } from '../sync/useBoardDoc'

export function Room() {
	const { roomId = '' } = useParams<{ roomId: string }>()
	const { board, status } = useBoardDoc(roomId)
	const [identity, setIdentity] = useState<Identity>(getIdentity)

	useEffect(() => {
		if (roomId) rememberBoard(roomId)
	}, [roomId])

	return (
		<div className="RoomWrapper">
			<div className="RoomWrapper-header">
				<Link to="/" className="RoomWrapper-home">
					Shoptet Canvas
				</Link>
				<StatusDot status={status} />
				{board ? <BoardName doc={board.doc} roomId={roomId} /> : <span>{roomId}</span>}
				<div className="RoomWrapper-spacer" />
				{board && <Collaborators provider={board.provider} />}
				<input
					className="HeaderInput YourName"
					placeholder="Your name"
					aria-label="Your name (shown on your cursor)"
					value={identity.name}
					maxLength={40}
					onChange={(e) => setIdentity(setIdentityName(e.target.value))}
					onKeyDown={(e) => e.stopPropagation()}
				/>
				<CopyLinkButton />
			</div>
			<div className="RoomWrapper-content">
				{board ? (
					<Board board={board} boardId={roomId} identity={identity} />
				) : (
					<div className="Loading">Connecting…</div>
				)}
			</div>
		</div>
	)
}

function StatusDot({ status }: { status: ConnectionStatus }) {
	const label = { connecting: 'Connecting…', connected: 'Live', disconnected: 'Offline — reconnecting' }[status]
	return <span className={`StatusDot StatusDot--${status}`} title={label} aria-label={label} />
}

function CopyLinkButton() {
	const [didCopy, setDidCopy] = useState(false)
	useEffect(() => {
		if (!didCopy) return
		const t = setTimeout(() => setDidCopy(false), 2000)
		return () => clearTimeout(t)
	}, [didCopy])
	return (
		<button
			className="RoomWrapper-copy"
			onClick={() => {
				navigator.clipboard.writeText(window.location.origin + window.location.pathname)
				setDidCopy(true)
			}}
		>
			{didCopy ? 'Copied!' : 'Copy link'}
		</button>
	)
}
